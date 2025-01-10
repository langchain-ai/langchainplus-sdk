import asyncio
import datetime
import uuid

import pytest
from pydantic import BaseModel

from langsmith import utils as ls_utils
from langsmith.async_client import AsyncClient
from langsmith.schemas import DataType, Run


@pytest.mark.asyncio
async def test_indexed_datasets():
    class InputsSchema(BaseModel):
        name: str  # type: ignore[annotation-unchecked]
        age: int  # type: ignore[annotation-unchecked]

    async with AsyncClient() as client:
        # Create a new dataset
        try:
            dataset = await client.create_dataset(
                "test_dataset_for_integration_tests_" + uuid.uuid4().hex,
                inputs_schema_definition=InputsSchema.model_json_schema(),
            )

            example = await client.create_example(
                inputs={"name": "Alice", "age": 30},
                outputs={"hi": "hello"},
                dataset_id=dataset.id,
            )

            await client.index_dataset(dataset_id=dataset.id)

            async def check_similar_examples():
                examples = await client.similar_examples(
                    {"name": "Alice", "age": 30}, dataset_id=dataset.id, limit=1
                )
                return len(examples) == 1

            await wait_for(check_similar_examples, timeout=20)
            examples = await client.similar_examples(
                {"name": "Alice", "age": 30}, dataset_id=dataset.id, limit=1
            )
            assert examples[0].id == example.id
        finally:
            await client.delete_dataset(dataset_id=dataset.id)


# Helper function to wait for a condition
async def wait_for(condition, timeout=10):
    start_time = asyncio.get_event_loop().time()
    while True:
        try:
            if await condition():
                return
        except Exception:
            if asyncio.get_event_loop().time() - start_time > timeout:
                raise TimeoutError("Condition not met within the timeout period")
            await asyncio.sleep(0.1)


@pytest.fixture
async def async_client():
    ls_utils.get_env_var.cache_clear()
    client = AsyncClient()
    yield client
    await client.aclose()


@pytest.mark.asyncio
async def test_create_run(async_client: AsyncClient):
    project_name = "__test_create_run" + uuid.uuid4().hex[:8]
    run_id = uuid.uuid4()

    await async_client.create_run(
        name="test_run",
        inputs={"input": "hello"},
        run_type="llm",
        project_name=project_name,
        id=run_id,
        start_time=datetime.datetime.now(datetime.timezone.utc),
    )

    async def check_run():
        try:
            run = await async_client.read_run(run_id)
            return run.name == "test_run"
        except ls_utils.LangSmithError:
            return False

    await wait_for(check_run)
    run = await async_client.read_run(run_id)
    assert run.name == "test_run"
    assert run.inputs == {"input": "hello"}


@pytest.mark.asyncio
async def test_list_runs(async_client: AsyncClient):
    project_name = "__test_list_runs"
    run_ids = [uuid.uuid4() for _ in range(3)]
    meta_uid = str(uuid.uuid4())

    for i, run_id in enumerate(run_ids):
        await async_client.create_run(
            name=f"test_run_{i}",
            inputs={"input": f"hello_{i}"},
            run_type="llm",
            project_name=project_name,
            id=run_id,
            start_time=datetime.datetime.now(datetime.timezone.utc),
            end_time=datetime.datetime.now(datetime.timezone.utc),
            extra={"metadata": {"uid": meta_uid}},
        )

    filter_ = f'and(eq(metadata_key, "uid"), eq(metadata_value, "{meta_uid}"))'

    async def check_runs():
        runs = [
            run
            async for run in async_client.list_runs(
                project_name=project_name, filter=filter_
            )
        ]
        return len(runs) == 3

    await wait_for(check_runs)

    runs = [
        run
        async for run in async_client.list_runs(
            project_name=project_name, filter=filter_
        )
    ]
    assert len(runs) == 3
    assert all(isinstance(run, Run) for run in runs)


@pytest.mark.asyncio
async def test_create_dataset(async_client: AsyncClient):
    dataset_name = "__test_create_dataset" + uuid.uuid4().hex[:8]

    dataset = await async_client.create_dataset(dataset_name, data_type=DataType.kv)

    assert dataset.name == dataset_name
    assert dataset.data_type == DataType.kv

    await async_client.delete_dataset(dataset_id=dataset.id)


@pytest.mark.asyncio
async def test_create_example(async_client: AsyncClient):
    dataset_name = "__test_create_example" + uuid.uuid4().hex[:8]
    dataset = await async_client.create_dataset(dataset_name)

    example = await async_client.create_example(
        inputs={"input": "hello"}, outputs={"output": "world"}, dataset_id=dataset.id
    )

    assert example.inputs == {"input": "hello"}
    assert example.outputs == {"output": "world"}

    await async_client.delete_dataset(dataset_id=dataset.id)


@pytest.mark.asyncio
async def test_list_examples(async_client: AsyncClient):
    dataset_name = "__test_list_examples" + uuid.uuid4().hex[:8]
    dataset = await async_client.create_dataset(dataset_name)

    for i in range(3):
        await async_client.create_example(
            inputs={"input": f"hello_{i}"},
            outputs={"output": f"world_{i}"},
            dataset_id=dataset.id,
        )

    examples = [
        example async for example in async_client.list_examples(dataset_id=dataset.id)
    ]
    assert len(examples) == 3

    await async_client.delete_dataset(dataset_id=dataset.id)


@pytest.mark.asyncio
async def test_create_feedback(async_client: AsyncClient):
    project_name = "__test_create_feedback" + uuid.uuid4().hex[:8]
    run_id = uuid.uuid4()

    await async_client.create_run(
        name="test_run",
        inputs={"input": "hello"},
        run_type="llm",
        project_name=project_name,
        id=run_id,
        start_time=datetime.datetime.now(datetime.timezone.utc),
    )

    feedback = await async_client.create_feedback(
        run_id=run_id,
        key="test_key",
        score=0.9,
        value="test_value",
        comment="test_comment",
    )

    assert feedback.run_id == run_id
    assert feedback.key == "test_key"
    assert feedback.score == 0.9
    assert feedback.value == "test_value"
    assert feedback.comment == "test_comment"

    token = await async_client.create_presigned_feedback_token(
        run_id=run_id, feedback_key="test_presigned_key"
    )
    await async_client.create_feedback_from_token(
        token.id, score=0.8, value="presigned_value", comment="presigned_comment"
    )
    await async_client.create_feedback_from_token(
        str(token.url), score=0.9, value="presigned_value", comment="presigned_comment"
    )

    async def check_feedback():
        feedbacks = [
            feedback async for feedback in async_client.list_feedback(run_ids=[run_id])
        ]
        return sum(feedback.key == "test_presigned_key" for feedback in feedbacks) == 2

    await wait_for(check_feedback, timeout=10)
    feedbacks = [
        feedback async for feedback in async_client.list_feedback(run_ids=[run_id])
    ]
    presigned_feedbacks = [f for f in feedbacks if f.key == "test_presigned_key"]
    assert len(presigned_feedbacks) == 2
    assert all(f.value == "presigned_value" for f in presigned_feedbacks)
    assert len(presigned_feedbacks) == 2
    for feedback in presigned_feedbacks:
        assert feedback.value == "presigned_value"
        assert feedback.comment == "presigned_comment"
        assert feedback.score in {0.8, 0.9}
    assert set(f.score for f in presigned_feedbacks) == {0.8, 0.9}

    shared_run_url = await async_client.share_run(run_id)
    run_is_shared = await async_client.run_is_shared(run_id)
    assert run_is_shared, f"Run isn't shared; failed link: {shared_run_url}"


@pytest.mark.asyncio
async def test_list_feedback(async_client: AsyncClient):
    project_name = "__test_list_feedback"
    run_id = uuid.uuid4()

    await async_client.create_run(
        name="test_run",
        inputs={"input": "hello"},
        run_type="llm",
        project_name=project_name,
        id=run_id,
        start_time=datetime.datetime.now(datetime.timezone.utc),
    )

    for i in range(3):
        await async_client.create_feedback(
            run_id=run_id,
            key=f"test_key_{i}",
            score=0.9,
            value=f"test_value_{i}",
            comment=f"test_comment_{i}",
        )

    async def check_feedbacks():
        feedbacks = [
            feedback async for feedback in async_client.list_feedback(run_ids=[run_id])
        ]
        return len(feedbacks) == 3

    await wait_for(check_feedbacks, timeout=10)

    feedbacks = [
        feedback async for feedback in async_client.list_feedback(run_ids=[run_id])
    ]
    assert len(feedbacks) == 3


@pytest.mark.asyncio
async def test_delete_feedback(async_client: AsyncClient):
    """Test deleting feedback."""
    project_name = "__test_delete_feedback" + uuid.uuid4().hex[:8]
    run_id = uuid.uuid4()

    await async_client.create_run(
        name="test_run",
        inputs={"input": "hello"},
        run_type="llm",
        project_name=project_name,
        id=run_id,
        start_time=datetime.datetime.now(datetime.timezone.utc),
    )

    # Create feedback
    feedback = await async_client.create_feedback(
        run_id=run_id,
        key="test_feedback",
        value=1,
        comment="test comment",
    )

    # Delete the feedback
    await async_client.delete_feedback(feedback.id)

    # Verify feedback is deleted by checking list_feedback
    feedbacks = [
        feedback async for feedback in async_client.list_feedback(run_ids=[run_id])
    ]
    assert len(feedbacks) == 0


@pytest.mark.asyncio
async def test_annotation_queue_crud(async_client: AsyncClient):
    """Test basic CRUD operations for annotation queues."""
    queue_name = f"test_queue_{uuid.uuid4().hex[:8]}"
    queue_id = uuid.uuid4()

    # Test creation
    queue = await async_client.create_annotation_queue(
        name=queue_name, description="Test queue", queue_id=queue_id
    )
    assert queue.name == queue_name
    assert queue.id == queue_id

    # Test reading
    read_queue = await async_client.read_annotation_queue(queue_id)
    assert read_queue.id == queue_id
    assert read_queue.name == queue_name

    # Test updating
    new_name = f"updated_{queue_name}"
    await async_client.update_annotation_queue(
        queue_id=queue_id, name=new_name, description="Updated description"
    )

    updated_queue = await async_client.read_annotation_queue(queue_id)
    assert updated_queue.name == new_name

    # Test deletion
    await async_client.delete_annotation_queue(queue_id)

    # Verify deletion
    queues = [
        queue
        async for queue in async_client.list_annotation_queues(queue_ids=[queue_id])
    ]
    assert len(queues) == 0


@pytest.mark.asyncio
async def test_list_annotation_queues(async_client: AsyncClient):
    """Test listing and filtering annotation queues."""
    queue_names = [f"test_queue_{i}_{uuid.uuid4().hex[:8]}" for i in range(3)]
    queue_ids = []

    try:
        # Create test queues
        for name in queue_names:
            queue = await async_client.create_annotation_queue(
                name=name, description="Test queue"
            )
            queue_ids.append(queue.id)

        # Test listing with various filters
        queues = [
            queue
            async for queue in async_client.list_annotation_queues(
                queue_ids=queue_ids[:2], limit=2
            )
        ]
        assert len(queues) == 2

        # Test name filter
        queues = [
            queue
            async for queue in async_client.list_annotation_queues(name=queue_names[0])
        ]
        assert len(queues) == 1
        assert queues[0].name == queue_names[0]

        # Test name_contains filter
        queues = [
            queue
            async for queue in async_client.list_annotation_queues(
                name_contains="test_queue"
            )
        ]
        assert len(queues) >= 3  # Could be more if other tests left queues

    finally:
        # Clean up
        for queue_id in queue_ids:
            await async_client.delete_annotation_queue(queue_id)


@pytest.mark.asyncio
async def test_annotation_queue_runs(async_client: AsyncClient):
    """Test managing runs within an annotation queue."""
    queue_name = f"test_queue_{uuid.uuid4().hex[:8]}"
    project_name = f"test_project_{uuid.uuid4().hex[:8]}"

    # Create a queue
    queue = await async_client.create_annotation_queue(
        name=queue_name, description="Test queue"
    )

    # Create some test runs
    run_ids = [uuid.uuid4() for _ in range(3)]
    for i in range(3):
        await async_client.create_run(
            name=f"test_run_{i}",
            inputs={"input": f"test_{i}"},
            run_type="llm",
            project_name=project_name,
            start_time=datetime.datetime.now(datetime.timezone.utc),
            id=run_ids[i],
        )

    # Add runs to queue
    await async_client.add_runs_to_annotation_queue(queue_id=queue.id, run_ids=run_ids)

    # Test getting run at index
    run_info = await async_client.get_run_from_annotation_queue(
        queue_id=queue.id, index=0
    )
    assert run_info.id in run_ids

    # Test deleting a run from queue
    await async_client.delete_run_from_annotation_queue(
        queue_id=queue.id, run_id=run_ids[2]
    )

    # Test that runs are deleted
    run = await async_client.get_run_from_annotation_queue(queue_id=queue.id, index=0)
    assert run.id == run_ids[1]

    # Clean up
    await async_client.delete_annotation_queue(queue.id)
