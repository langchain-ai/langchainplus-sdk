"""LangSmith langchain_client Integration Tests."""

import datetime
import io
import logging
import os
import random
import string
import sys
import time
import uuid
from datetime import timedelta
from typing import Any, Callable, Dict
from unittest import mock
from uuid import uuid4

import pytest
from freezegun import freeze_time
from pydantic import BaseModel
from requests_toolbelt import MultipartEncoder, MultipartEncoderMonitor

from langsmith._internal._serde import dumps_json
from langsmith.client import ID_TYPE, Client
from langsmith.evaluation import aevaluate, evaluate
from langsmith.schemas import (
    AttachmentsOperations,
    DataType,
    Example,
    ExampleUpdateWithAttachments,
    ExampleUploadWithAttachments,
    ExampleUpsertWithAttachments,
    Run,
)
from langsmith.utils import (
    LangSmithConnectionError,
    LangSmithError,
    LangSmithNotFoundError,
    get_env_var,
)

logger = logging.getLogger(__name__)


def wait_for(
    condition: Callable[[], bool], max_sleep_time: int = 120, sleep_time: int = 3
):
    """Wait for a condition to be true."""
    start_time = time.time()
    while time.time() - start_time < max_sleep_time:
        try:
            if condition():
                return
        except Exception:
            time.sleep(sleep_time)
    total_time = time.time() - start_time
    raise ValueError(f"Callable did not return within {total_time}")


@pytest.fixture
def langchain_client() -> Client:
    get_env_var.cache_clear()
    return Client(
        info={
            "instance_flags": {
                "dataset_examples_multipart_enabled": True,
                "examples_multipart_enabled": True,
            }
        },
    )


def test_datasets(langchain_client: Client) -> None:
    """Test datasets."""
    csv_content = "col1,col2\nval1,val2"
    blob_data = io.BytesIO(csv_content.encode("utf-8"))

    description = "Test Dataset"
    input_keys = ["col1"]
    output_keys = ["col2"]
    filename = "".join(random.sample(string.ascii_lowercase, 10)) + ".csv"
    new_dataset = langchain_client.upload_csv(
        csv_file=(filename, blob_data),
        description=description,
        input_keys=input_keys,
        output_keys=output_keys,
    )
    assert new_dataset.id is not None
    assert new_dataset.description == description

    dataset = langchain_client.read_dataset(dataset_id=new_dataset.id)
    dataset_id = dataset.id
    dataset2 = langchain_client.read_dataset(dataset_id=dataset_id)
    assert dataset.id == dataset2.id

    datasets = list(langchain_client.list_datasets())
    assert len(datasets) > 0
    assert dataset_id in [dataset.id for dataset in datasets]

    # Test Example CRD
    example = langchain_client.create_example(
        inputs={"col1": "addedExampleCol1"},
        outputs={"col2": "addedExampleCol2"},
        dataset_id=new_dataset.id,
    )
    example_value = langchain_client.read_example(example.id)
    assert example_value.inputs is not None
    assert example_value.inputs["col1"] == "addedExampleCol1"
    assert example_value.outputs is not None
    assert example_value.outputs["col2"] == "addedExampleCol2"

    examples = list(
        langchain_client.list_examples(dataset_id=new_dataset.id)  # type: ignore
    )
    assert len(examples) == 2
    assert example.id in [example.id for example in examples]

    langchain_client.update_example(
        example_id=example.id,
        inputs={"col1": "updatedExampleCol1"},
        outputs={"col2": "updatedExampleCol2"},
        metadata={"foo": "bar"},
    )
    updated_example = langchain_client.read_example(example.id)
    assert updated_example.id == example.id
    updated_example_value = langchain_client.read_example(updated_example.id)
    assert updated_example_value.inputs["col1"] == "updatedExampleCol1"
    assert updated_example_value.outputs is not None
    assert updated_example_value.outputs["col2"] == "updatedExampleCol2"
    assert (updated_example_value.metadata or {}).get("foo") == "bar"

    new_example = langchain_client.create_example(
        inputs={"col1": "newAddedExampleCol1"},
        outputs={"col2": "newAddedExampleCol2"},
        dataset_id=new_dataset.id,
    )
    example_value = langchain_client.read_example(new_example.id)
    assert example_value.inputs is not None
    assert example_value.inputs["col1"] == "newAddedExampleCol1"
    assert example_value.outputs is not None
    assert example_value.outputs["col2"] == "newAddedExampleCol2"

    langchain_client.update_examples(
        example_ids=[new_example.id, example.id],
        inputs=[{"col1": "newUpdatedExampleCol1"}, {"col1": "newNewUpdatedExampleCol"}],
        outputs=[
            {"col2": "newUpdatedExampleCol2"},
            {"col2": "newNewUpdatedExampleCol2"},
        ],
        metadata=[{"foo": "baz"}, {"foo": "qux"}],
    )
    updated_example = langchain_client.read_example(new_example.id)
    assert updated_example.id == new_example.id
    assert updated_example.inputs["col1"] == "newUpdatedExampleCol1"
    assert updated_example.outputs is not None
    assert updated_example.outputs["col2"] == "newUpdatedExampleCol2"
    assert (updated_example.metadata or {}).get("foo") == "baz"

    updated_example = langchain_client.read_example(example.id)
    assert updated_example.id == example.id
    assert updated_example.inputs["col1"] == "newNewUpdatedExampleCol"
    assert updated_example.outputs is not None
    assert updated_example.outputs["col2"] == "newNewUpdatedExampleCol2"
    assert (updated_example.metadata or {}).get("foo") == "qux"

    langchain_client.delete_example(example.id)
    examples2 = list(
        langchain_client.list_examples(dataset_id=new_dataset.id)  # type: ignore
    )
    assert len(examples2) == 2
    langchain_client.delete_dataset(dataset_id=dataset_id)


def test_list_examples(langchain_client: Client) -> None:
    """Test list_examples."""
    examples = [
        ("Shut up, idiot", "Toxic", ["train", "validation"]),
        ("You're a wonderful person", "Not toxic", "test"),
        ("This is the worst thing ever", "Toxic", ["train"]),
        ("I had a great day today", "Not toxic", "test"),
        ("Nobody likes you", "Toxic", "train"),
        ("This is unacceptable. I want to speak to the manager.", "Not toxic", None),
    ]

    dataset_name = "__test_list_examples" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(dataset_name=dataset_name)
    inputs, outputs, splits = zip(
        *[({"text": text}, {"label": label}, split) for text, label, split in examples]
    )
    langchain_client.create_examples(
        inputs=inputs, outputs=outputs, splits=splits, dataset_id=dataset.id
    )
    example_list = list(langchain_client.list_examples(dataset_id=dataset.id))
    assert len(example_list) == len(examples)

    example_list = list(
        langchain_client.list_examples(dataset_id=dataset.id, offset=1, limit=2)
    )
    assert len(example_list) == 2

    example_list = list(langchain_client.list_examples(dataset_id=dataset.id, offset=1))
    assert len(example_list) == len(examples) - 1

    example_list = list(
        langchain_client.list_examples(dataset_id=dataset.id, splits=["train"])
    )
    assert len(example_list) == 3

    example_list = list(
        langchain_client.list_examples(dataset_id=dataset.id, splits=["validation"])
    )
    assert len(example_list) == 1

    example_list = list(
        langchain_client.list_examples(dataset_id=dataset.id, splits=["test"])
    )
    assert len(example_list) == 2

    example_list = list(
        langchain_client.list_examples(dataset_id=dataset.id, splits=["train", "test"])
    )
    assert len(example_list) == 5

    langchain_client.update_example(
        example_id=[
            example.id
            for example in example_list
            if example.metadata is not None
            and "test" in example.metadata.get("dataset_split", [])
        ][0],
        split="train",
    )

    example_list = list(
        langchain_client.list_examples(dataset_id=dataset.id, splits=["test"])
    )
    assert len(example_list) == 1

    example_list = list(
        langchain_client.list_examples(dataset_id=dataset.id, splits=["train"])
    )
    assert len(example_list) == 4

    langchain_client.create_example(
        inputs={"text": "What's up!"},
        outputs={"label": "Not toxic"},
        metadata={"foo": "bar", "baz": "qux"},
        dataset_name=dataset_name,
    )

    example_list = list(langchain_client.list_examples(dataset_id=dataset.id))
    assert len(example_list) == len(examples) + 1

    example_list = list(
        langchain_client.list_examples(dataset_id=dataset.id, metadata={"foo": "bar"})
    )
    assert len(example_list) == 1

    example_list = list(
        langchain_client.list_examples(dataset_id=dataset.id, metadata={"baz": "qux"})
    )
    assert len(example_list) == 1

    example_list = list(
        langchain_client.list_examples(
            dataset_id=dataset.id, metadata={"foo": "bar", "baz": "qux"}
        )
    )
    assert len(example_list) == 1

    example_list = list(
        langchain_client.list_examples(
            dataset_id=dataset.id, metadata={"foo": "bar", "baz": "quux"}
        )
    )
    assert len(example_list) == 0

    example_list = list(
        langchain_client.list_examples(
            dataset_id=dataset.id, filter='exists(metadata, "baz")'
        )
    )
    assert len(example_list) == 1

    example_list = list(
        langchain_client.list_examples(
            dataset_id=dataset.id, filter='has("metadata", \'{"foo": "bar"}\')'
        )
    )
    assert len(example_list) == 1

    example_list = list(
        langchain_client.list_examples(
            dataset_id=dataset.id, filter='exists(metadata, "bazzz")'
        )
    )
    assert len(example_list) == 0

    langchain_client.delete_dataset(dataset_id=dataset.id)


@pytest.mark.slow
def test_similar_examples(langchain_client: Client) -> None:
    inputs = [{"text": "how are you"}, {"text": "good bye"}, {"text": "see ya later"}]
    outputs = [
        {"response": "good how are you"},
        {"response": "ta ta"},
        {"response": "tootles"},
    ]
    dataset_name = "__test_similar_examples" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(
        dataset_name=dataset_name,
        inputs_schema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
                "text": {"type": "string"},
            },
            "required": ["text"],
            "additionalProperties": False,
        },
        outputs_schema={
            "$schema": "http://json-schema.org/draft-07/schema#",
            "type": "object",
            "properties": {
                "response": {"type": "string"},
            },
            "required": ["response"],
            "additionalProperties": False,
        },
    )
    langchain_client.create_examples(
        inputs=inputs, outputs=outputs, dataset_id=dataset.id
    )
    langchain_client.index_dataset(dataset_id=dataset.id)
    # Need to wait for indexing to finish.
    time.sleep(5)
    similar_list = langchain_client.similar_examples(
        {"text": "howdy"}, limit=2, dataset_id=dataset.id
    )
    assert len(similar_list) == 2

    langchain_client.delete_dataset(dataset_id=dataset.id)


@pytest.mark.skip(reason="This test is flaky")
def test_persist_update_run(langchain_client: Client) -> None:
    """Test the persist and update methods work as expected."""
    project_name = "__test_persist_update_run" + uuid4().hex[:4]
    if langchain_client.has_project(project_name):
        langchain_client.delete_project(project_name=project_name)
    try:
        start_time = datetime.datetime.now()
        revision_id = uuid4()
        run: dict = dict(
            id=uuid4(),
            name="test_run",
            run_type="llm",
            inputs={"text": "hello world"},
            project_name=project_name,
            api_url=os.getenv("LANGCHAIN_ENDPOINT"),
            start_time=start_time,
            extra={"extra": "extra"},
            revision_id=revision_id,
        )
        langchain_client.create_run(**run)
        run["outputs"] = {"output": ["Hi"]}
        run["extra"]["foo"] = "bar"
        run["name"] = "test_run_updated"
        langchain_client.update_run(run["id"], **run)
        wait_for(lambda: langchain_client.read_run(run["id"]).end_time is not None)
        stored_run = langchain_client.read_run(run["id"])
        assert stored_run.name == run["name"]
        assert stored_run.id == run["id"]
        assert stored_run.outputs == run["outputs"]
        assert stored_run.start_time == run["start_time"]
        assert stored_run.revision_id == str(revision_id)
    finally:
        langchain_client.delete_project(project_name=project_name)


@pytest.mark.parametrize("uri", ["http://localhost:1981", "http://api.langchain.minus"])
def test_error_surfaced_invalid_uri(uri: str) -> None:
    get_env_var.cache_clear()
    client = Client(api_url=uri, api_key="test")
    # expect connect error
    with pytest.raises(LangSmithConnectionError):
        client.create_run("My Run", inputs={"text": "hello world"}, run_type="llm")


def test_upload_examples_multipart(langchain_client: Client):
    """Test uploading examples with attachments via multipart endpoint."""
    dataset_name = "__test_upload_examples_multipart" + uuid4().hex[:4]
    if langchain_client.has_dataset(dataset_name=dataset_name):
        langchain_client.delete_dataset(dataset_name=dataset_name)

    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for multipart example upload",
        data_type=DataType.kv,
    )

    # Test example with all fields
    example_id = uuid4()
    example_1 = ExampleUploadWithAttachments(
        id=example_id,
        inputs={"text": "hello world"},
        attachments={
            "test_file": ("text/plain", b"test content"),
        },
    )

    # Test example with minimum required fields
    example_2 = ExampleUploadWithAttachments(
        inputs={"text": "minimal example"},
    )

    # Test example with outputs and multiple attachments
    example_3 = ExampleUploadWithAttachments(
        inputs={"text": "example with outputs"},
        outputs={"response": "test response"},
        attachments={
            "file1": ("text/plain", b"content 1"),
            "file2": ("text/plain", b"content 2"),
        },
    )

    # Test uploading multiple examples at once
    created_examples = langchain_client.upload_examples_multipart(
        dataset_id=dataset.id, uploads=[example_1, example_2, example_3]
    )
    assert created_examples["count"] == 3

    created_example_1 = langchain_client.read_example(example_id)
    assert created_example_1.inputs["text"] == "hello world"

    # Verify the examples were created correctly
    examples = [
        ex
        for ex in langchain_client.list_examples(
            dataset_id=dataset.id,
            include_attachments=True,
        )
    ]
    assert len(examples) == 3

    # Verify example with ID was created with correct ID
    example_with_id = [ex for ex in examples if ex.id == example_id][0]
    assert example_with_id.inputs["text"] == "hello world"
    assert "test_file" in example_with_id.attachments

    # Verify example with outputs and multiple attachments
    example_with_outputs = next(
        ex
        for ex in examples
        if ex.outputs and ex.outputs.get("response") == "test response"
    )
    assert len(example_with_outputs.attachments) == 2
    assert "file1" in example_with_outputs.attachments
    assert "file2" in example_with_outputs.attachments

    # Test uploading to non-existent dataset fails
    fake_id = uuid4()
    with pytest.raises(LangSmithNotFoundError):
        langchain_client.upload_examples_multipart(
            dataset_id=fake_id,
            uploads=[
                ExampleUploadWithAttachments(
                    inputs={"text": "should fail"},
                )
            ],
        )

    # Clean up
    langchain_client.delete_dataset(dataset_name=dataset_name)


def test_upsert_examples_multipart(langchain_client: Client) -> None:
    """Test upserting examples with attachments via the multipart endpoint."""
    dataset_name = "__test_upsert_examples_multipart" + uuid4().hex[:4]
    if langchain_client.has_dataset(dataset_name=dataset_name):
        langchain_client.delete_dataset(dataset_name=dataset_name)

    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for multipart example upload",
        data_type=DataType.kv,
    )

    # Test example with all fields
    example_id = uuid4()
    example_1 = ExampleUpsertWithAttachments(
        id=example_id,
        dataset_id=dataset.id,
        inputs={"text": "hello world"},
        # test without outputs
        attachments={
            "test_file": ("text/plain", b"test content"),
        },
    )
    # Test example without id
    example_2 = ExampleUpsertWithAttachments(
        dataset_id=dataset.id,
        inputs={"text": "foo bar"},
        outputs={"response": "baz"},
        attachments={
            "my_file": ("text/plain", b"more test content"),
        },
    )
    created_examples = langchain_client.upsert_examples_multipart(
        upserts=[example_1, example_2]
    )
    assert created_examples["count"] == 2

    created_example_1 = langchain_client.read_example(example_id)
    assert created_example_1.inputs["text"] == "hello world"
    assert created_example_1.outputs is None

    created_example_2 = langchain_client.read_example(
        [id_ for id_ in created_examples["example_ids"] if id_ != str(example_id)][0]
    )
    assert created_example_2.inputs["text"] == "foo bar"
    assert created_example_2.outputs["response"] == "baz"

    # make sure examples were sent to the correct dataset
    all_examples_in_dataset = [
        example for example in langchain_client.list_examples(dataset_id=dataset.id)
    ]
    assert len(all_examples_in_dataset) == 2

    example_1_update = ExampleUpsertWithAttachments(
        id=example_id,
        dataset_id=dataset.id,
        inputs={"text": "bar baz"},
        outputs={"response": "foo"},
        attachments={
            "my_file": ("text/plain", b"more test content"),
        },
    )
    updated_examples = langchain_client.upsert_examples_multipart(
        upserts=[example_1_update]
    )
    assert updated_examples["count"] == 0
    # Test that adding invalid example fails
    # even if valid examples are added alongside
    example_3 = ExampleUpsertWithAttachments(
        dataset_id=uuid4(),  # not a real dataset
        inputs={"text": "foo bar"},
        outputs={"response": "baz"},
        attachments={
            "my_file": ("text/plain", b"more test content"),
        },
    )

    with pytest.raises(LangSmithNotFoundError):
        langchain_client.upsert_examples_multipart(upserts=[example_3])

    all_examples_in_dataset = [
        example for example in langchain_client.list_examples(dataset_id=dataset.id)
    ]
    assert len(all_examples_in_dataset) == 2

    # Throw type errors when not passing ExampleUpsertWithAttachments
    with pytest.raises(ValueError):
        langchain_client.upsert_examples_multipart(upserts=[{"foo": "bar"}])
    langchain_client.delete_dataset(dataset_name=dataset_name)


def test_create_dataset(langchain_client: Client) -> None:
    dataset_name = "__test_create_dataset" + uuid4().hex[:4]
    if langchain_client.has_dataset(dataset_name=dataset_name):
        langchain_client.delete_dataset(dataset_name=dataset_name)
    dataset = langchain_client.create_dataset(dataset_name, data_type=DataType.llm)
    ground_truth = "bcde"
    example = langchain_client.create_example(
        inputs={"input": "hello world"},
        outputs={"output": ground_truth},
        dataset_id=dataset.id,
    )
    initial_version = example.modified_at
    loaded_dataset = langchain_client.read_dataset(dataset_name=dataset_name)
    assert loaded_dataset.data_type == DataType.llm
    example_2 = langchain_client.create_example(
        inputs={"input": "hello world 2"},
        outputs={"output": "fghi"},
        dataset_id=dataset.id,
    )
    langchain_client.update_example(
        example_id=example.id,
        inputs={"input": "hello world"},
        outputs={"output": "bcde"},
    )
    initial_examples = list(
        langchain_client.list_examples(dataset_id=dataset.id, as_of=initial_version)
    )
    assert len(initial_examples) == 1
    latest_examples = list(langchain_client.list_examples(dataset_id=dataset.id))
    assert len(latest_examples) == 2
    latest_tagged_examples = list(
        langchain_client.list_examples(dataset_id=dataset.id, as_of="latest")
    )
    assert len(latest_tagged_examples) == 2
    assert latest_tagged_examples == latest_examples
    diffs = langchain_client.diff_dataset_versions(
        loaded_dataset.id, from_version=initial_version, to_version="latest"
    )
    assert diffs.examples_added == [example_2.id]
    assert diffs.examples_removed == []
    assert diffs.examples_modified == [example.id]
    langchain_client.delete_dataset(dataset_id=dataset.id)


def test_dataset_schema_validation(langchain_client: Client) -> None:
    dataset_name = "__test_create_dataset" + uuid4().hex[:4]
    if langchain_client.has_dataset(dataset_name=dataset_name):
        langchain_client.delete_dataset(dataset_name=dataset_name)

    class InputSchema(BaseModel):
        input: str

    class OutputSchema(BaseModel):
        output: str

    dataset = langchain_client.create_dataset(
        dataset_name,
        data_type=DataType.kv,
        inputs_schema=InputSchema.model_json_schema(),
        outputs_schema=OutputSchema.model_json_schema(),
    )

    # confirm we store the schema from the create request
    assert dataset.inputs_schema == InputSchema.model_json_schema()
    assert dataset.outputs_schema == OutputSchema.model_json_schema()

    # create an example that matches the schema, which should succeed
    langchain_client.create_example(
        inputs={"input": "hello world"},
        outputs={"output": "hello"},
        dataset_id=dataset.id,
    )

    # create an example that does not match the input schema
    with pytest.raises(LangSmithError):
        langchain_client.create_example(
            inputs={"john": 1},
            outputs={"output": "hello"},
            dataset_id=dataset.id,
        )

    # create an example that does not match the output schema
    with pytest.raises(LangSmithError):
        langchain_client.create_example(
            inputs={"input": "hello world"},
            outputs={"john": 1},
            dataset_id=dataset.id,
        )

    # assert read API includes the schema definition
    read_dataset = langchain_client.read_dataset(dataset_id=dataset.id)
    assert read_dataset.inputs_schema == InputSchema.model_json_schema()
    assert read_dataset.outputs_schema == OutputSchema.model_json_schema()

    langchain_client.delete_dataset(dataset_id=dataset.id)


@freeze_time("2023-01-01")
def test_list_datasets(langchain_client: Client) -> None:
    ds1n = "__test_list_datasets1" + uuid4().hex[:4]
    ds2n = "__test_list_datasets2" + uuid4().hex[:4]
    try:
        dataset1 = langchain_client.create_dataset(
            ds1n, data_type=DataType.llm, metadata={"foo": "barqux"}
        )
        dataset2 = langchain_client.create_dataset(ds2n, data_type=DataType.kv)
        assert dataset1.url is not None
        assert dataset2.url is not None
        datasets = list(
            langchain_client.list_datasets(dataset_ids=[dataset1.id, dataset2.id])
        )
        assert len(datasets) == 2
        assert dataset1.id in [dataset.id for dataset in datasets]
        assert dataset2.id in [dataset.id for dataset in datasets]
        assert dataset1.data_type == DataType.llm
        assert dataset2.data_type == DataType.kv
        # Sub-filter on data type
        datasets = list(langchain_client.list_datasets(data_type=DataType.llm.value))
        assert len(datasets) > 0
        assert dataset1.id in {dataset.id for dataset in datasets}
        # Sub-filter on name
        datasets = list(
            langchain_client.list_datasets(
                dataset_ids=[dataset1.id, dataset2.id], dataset_name=ds1n
            )
        )
        assert len(datasets) == 1
        # Sub-filter on metadata
        datasets = list(
            langchain_client.list_datasets(
                dataset_ids=[dataset1.id, dataset2.id], metadata={"foo": "barqux"}
            )
        )
        assert len(datasets) == 1
    finally:
        # Delete datasets
        for name in [ds1n, ds2n]:
            try:
                langchain_client.delete_dataset(dataset_name=name)
            except LangSmithError:
                pass


@pytest.mark.skip(reason="This test is flaky")
def test_create_run_with_masked_inputs_outputs(
    langchain_client: Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    project_name = "__test_create_run_with_masked_inputs_outputs" + uuid4().hex[:4]
    monkeypatch.setenv("LANGCHAIN_HIDE_INPUTS", "true")
    monkeypatch.setenv("LANGCHAIN_HIDE_OUTPUTS", "true")
    if langchain_client.has_project(project_name):
        langchain_client.delete_project(project_name=project_name)
    try:
        run_id = uuid4()
        langchain_client.create_run(
            id=run_id,
            project_name=project_name,
            name="test_run",
            run_type="llm",
            inputs={"prompt": "hello world"},
            outputs={"generation": "hi there"},
            start_time=datetime.datetime.now(datetime.timezone.utc),
            end_time=datetime.datetime.now(datetime.timezone.utc),
            hide_inputs=True,
            hide_outputs=True,
        )

        run_id2 = uuid4()
        langchain_client.create_run(
            id=run_id2,
            project_name=project_name,
            name="test_run_2",
            run_type="llm",
            inputs={"messages": "hello world 2"},
            start_time=datetime.datetime.now(datetime.timezone.utc),
            hide_inputs=True,
        )

        langchain_client.update_run(
            run_id2,
            outputs={"generation": "hi there 2"},
            end_time=datetime.datetime.now(datetime.timezone.utc),
            hide_outputs=True,
        )
        wait_for(lambda: langchain_client.read_run(run_id).end_time is not None)
        stored_run = langchain_client.read_run(run_id)
        assert "hello" not in str(stored_run.inputs)
        assert stored_run.outputs is not None
        assert "hi" not in str(stored_run.outputs)
        wait_for(lambda: langchain_client.read_run(run_id2).end_time is not None)
        stored_run2 = langchain_client.read_run(run_id2)
        assert "hello" not in str(stored_run2.inputs)
        assert stored_run2.outputs is not None
        assert "hi" not in str(stored_run2.outputs)
    finally:
        langchain_client.delete_project(project_name=project_name)


@freeze_time("2023-01-01")
def test_create_chat_example(
    monkeypatch: pytest.MonkeyPatch, langchain_client: Client
) -> None:
    from langchain.schema import FunctionMessage, HumanMessage

    dataset_name = "__createChatExample-test-dataset"
    try:
        existing_dataset = langchain_client.read_dataset(dataset_name=dataset_name)
        langchain_client.delete_dataset(dataset_id=existing_dataset.id)
    except LangSmithError:
        # If the dataset doesn't exist,
        pass

    dataset = langchain_client.create_dataset(dataset_name)

    input = [HumanMessage(content="Hello, world!")]
    generation = FunctionMessage(
        name="foo",
        content="",
        additional_kwargs={"function_call": {"arguments": "args", "name": "foo"}},
    )
    # Create the example from messages
    langchain_client.create_chat_example(input, generation, dataset_id=dataset.id)

    # Read the example
    examples = []
    for example in langchain_client.list_examples(dataset_id=dataset.id):
        examples.append(example)
    assert len(examples) == 1
    assert examples[0].inputs == {
        "input": [
            {
                "type": "human",
                "data": {"content": "Hello, world!"},
            },
        ],
    }
    assert examples[0].outputs == {
        "output": {
            "type": "function",
            "data": {
                "content": "",
                "additional_kwargs": {
                    "function_call": {"arguments": "args", "name": "foo"}
                },
            },
        },
    }
    langchain_client.delete_dataset(dataset_id=dataset.id)


@pytest.mark.parametrize("use_multipart_endpoint", [True, False])
def test_batch_ingest_runs(
    langchain_client: Client, use_multipart_endpoint: bool
) -> None:
    _session = "__test_batch_ingest_runs"
    trace_id = uuid4()
    trace_id_2 = uuid4()
    run_id_2 = uuid4()
    current_time = datetime.datetime.now(datetime.timezone.utc).strftime(
        "%Y%m%dT%H%M%S%fZ"
    )
    later_time = (
        datetime.datetime.now(datetime.timezone.utc) + timedelta(seconds=1)
    ).strftime("%Y%m%dT%H%M%S%fZ")

    """
    Here we create:
    - run 1: a top level trace with inputs and outputs
    - run 3: a top level trace with an error with inputs and outputs
    - run 2: a child of run 1 with inputs, no outputs
    and we update:
    - run 2 (the child): to add outputs
    """

    runs_to_create = [
        {
            "id": str(trace_id),
            "session_name": _session,
            "name": "run 1",
            "run_type": "chain",
            "dotted_order": f"{current_time}{str(trace_id)}",
            "trace_id": str(trace_id),
            "inputs": {"input1": 1, "input2": 2},
            "outputs": {"output1": 3, "output2": 4},
        },
        {
            "id": str(trace_id_2),
            "session_name": _session,
            "name": "run 3",
            "run_type": "chain",
            "dotted_order": f"{current_time}{str(trace_id_2)}",
            "trace_id": str(trace_id_2),
            "inputs": {"input1": 1, "input2": 2},
            "error": "error",
        },
        {
            "id": str(run_id_2),
            "session_name": _session,
            "name": "run 2",
            "run_type": "chain",
            "dotted_order": f"{current_time}{str(trace_id)}."
            f"{later_time}{str(run_id_2)}",
            "trace_id": str(trace_id),
            "parent_run_id": str(trace_id),
            "inputs": {"input1": 5, "input2": 6},
        },
    ]
    runs_to_update = [
        {
            "id": str(run_id_2),
            "dotted_order": f"{current_time}{str(trace_id)}."
            f"{later_time}{str(run_id_2)}",
            "trace_id": str(trace_id),
            "parent_run_id": str(trace_id),
            "outputs": {"output1": 4, "output2": 5},
        },
    ]
    if use_multipart_endpoint:
        langchain_client.multipart_ingest(create=runs_to_create, update=runs_to_update)
    else:
        langchain_client.batch_ingest_runs(create=runs_to_create, update=runs_to_update)
    runs = []
    wait = 4
    for _ in range(15):
        try:
            runs = list(
                langchain_client.list_runs(
                    project_name=_session,
                    run_ids=[str(trace_id), str(run_id_2), str(trace_id_2)],
                )
            )
            if len(runs) == 3:
                break
            raise LangSmithError("Runs not created yet")
        except LangSmithError:
            time.sleep(wait)
            wait += 1
    else:
        raise ValueError("Runs not created in time")
    assert len(runs) == 3
    # Write all the assertions here
    assert len(runs) == 3

    # Assert inputs and outputs of run 1
    run1 = next(run for run in runs if run.id == trace_id)
    assert run1.inputs == {"input1": 1, "input2": 2}
    assert run1.outputs == {"output1": 3, "output2": 4}

    # Assert inputs and outputs of run 2
    run2 = next(run for run in runs if run.id == run_id_2)
    assert run2.inputs == {"input1": 5, "input2": 6}
    assert run2.outputs == {"output1": 4, "output2": 5}

    # Assert inputs and outputs of run 3
    run3 = next(run for run in runs if run.id == trace_id_2)
    assert run3.inputs == {"input1": 1, "input2": 2}
    assert run3.error == "error"


def test_multipart_ingest_empty(
    langchain_client: Client, caplog: pytest.LogCaptureFixture
) -> None:
    runs_to_create: list[dict] = []
    runs_to_update: list[dict] = []

    # make sure no warnings logged
    with caplog.at_level(logging.WARNING, logger="langsmith.client"):
        langchain_client.multipart_ingest(create=runs_to_create, update=runs_to_update)

        assert not caplog.records


def test_multipart_ingest_create_then_update(
    langchain_client: Client, caplog: pytest.LogCaptureFixture
) -> None:
    _session = "__test_multipart_ingest_create_then_update"

    trace_a_id = uuid4()
    current_time = datetime.datetime.now(datetime.timezone.utc).strftime(
        "%Y%m%dT%H%M%S%fZ"
    )

    runs_to_create: list[dict] = [
        {
            "id": str(trace_a_id),
            "session_name": _session,
            "name": "trace a root",
            "run_type": "chain",
            "dotted_order": f"{current_time}{str(trace_a_id)}",
            "trace_id": str(trace_a_id),
            "inputs": {"input1": 1, "input2": 2},
        }
    ]

    # make sure no warnings logged
    with caplog.at_level(logging.WARNING, logger="langsmith.client"):
        langchain_client.multipart_ingest(create=runs_to_create, update=[])

        assert not caplog.records

    runs_to_update: list[dict] = [
        {
            "id": str(trace_a_id),
            "dotted_order": f"{current_time}{str(trace_a_id)}",
            "trace_id": str(trace_a_id),
            "outputs": {"output1": 3, "output2": 4},
        }
    ]
    with caplog.at_level(logging.WARNING, logger="langsmith.client"):
        langchain_client.multipart_ingest(create=[], update=runs_to_update)

        assert not caplog.records


def test_multipart_ingest_update_then_create(
    langchain_client: Client, caplog: pytest.LogCaptureFixture
) -> None:
    _session = "__test_multipart_ingest_update_then_create"

    trace_a_id = uuid4()
    current_time = datetime.datetime.now(datetime.timezone.utc).strftime(
        "%Y%m%dT%H%M%S%fZ"
    )

    runs_to_update: list[dict] = [
        {
            "id": str(trace_a_id),
            "dotted_order": f"{current_time}{str(trace_a_id)}",
            "trace_id": str(trace_a_id),
            "outputs": {"output1": 3, "output2": 4},
        }
    ]

    # make sure no warnings logged
    with caplog.at_level(logging.WARNING, logger="langsmith.client"):
        langchain_client.multipart_ingest(create=[], update=runs_to_update)

        assert not caplog.records

    runs_to_create: list[dict] = [
        {
            "id": str(trace_a_id),
            "session_name": _session,
            "name": "trace a root",
            "run_type": "chain",
            "dotted_order": f"{current_time}{str(trace_a_id)}",
            "trace_id": str(trace_a_id),
            "inputs": {"input1": 1, "input2": 2},
        }
    ]

    with caplog.at_level(logging.WARNING, logger="langsmith.client"):
        langchain_client.multipart_ingest(create=runs_to_create, update=[])

        assert not caplog.records


def test_multipart_ingest_create_wrong_type(
    langchain_client: Client, caplog: pytest.LogCaptureFixture
) -> None:
    _session = "__test_multipart_ingest_create_then_update"

    trace_a_id = uuid4()
    current_time = datetime.datetime.now(datetime.timezone.utc).strftime(
        "%Y%m%dT%H%M%S%fZ"
    )

    runs_to_create: list[dict] = [
        {
            "id": str(trace_a_id),
            "session_name": _session,
            "name": "trace a root",
            "run_type": "agent",
            "dotted_order": f"{current_time}{str(trace_a_id)}",
            "trace_id": str(trace_a_id),
            "inputs": {"input1": 1, "input2": 2},
        }
    ]

    # make sure no warnings logged
    with caplog.at_level(logging.WARNING, logger="langsmith.client"):
        langchain_client.multipart_ingest(create=runs_to_create, update=[])

        # this should 422
        assert len(caplog.records) == 1, "Should get 1 warning for 422, not retried"
        assert all("422" in record.message for record in caplog.records)


@freeze_time("2023-01-01")
def test_get_info() -> None:
    langchain_client = Client(api_key="not-a-real-key")
    info = langchain_client.info
    assert info
    assert info.version is not None  # type: ignore
    assert info.batch_ingest_config is not None  # type: ignore
    assert info.batch_ingest_config["size_limit"] > 0  # type: ignore


@pytest.mark.skip(reason="This test is flaky")
@pytest.mark.parametrize("add_metadata", [True, False])
@pytest.mark.parametrize("do_batching", [True, False])
def test_update_run_extra(add_metadata: bool, do_batching: bool) -> None:
    langchain_client = Client()
    run_id = uuid4()
    run: Dict[str, Any] = {
        "id": run_id,
        "name": "run 1",
        "start_time": datetime.datetime.now(datetime.timezone.utc),
        "run_type": "chain",
        "inputs": {"input1": 1, "input2": 2},
        "outputs": {"output1": 3, "output2": 4},
        "extra": {
            "metadata": {
                "foo": "bar",
            }
        },
        "tags": ["tag1", "tag2"],
    }
    if do_batching:
        run["trace_id"] = run_id
        dotted_order = run["start_time"].strftime("%Y%m%dT%H%M%S%fZ") + str(run_id)  # type: ignore
        run["dotted_order"] = dotted_order
    revision_id = uuid4()
    langchain_client.create_run(**run, revision_id=revision_id)  # type: ignore

    def _get_run(run_id: ID_TYPE, has_end: bool = False) -> bool:
        try:
            r = langchain_client.read_run(run_id)  # type: ignore
            if has_end:
                return r.end_time is not None
            return True
        except LangSmithError:
            return False

    wait_for(lambda: _get_run(run_id))
    created_run = langchain_client.read_run(run_id)
    assert created_run.metadata["foo"] == "bar"
    assert created_run.metadata["revision_id"] == str(revision_id)
    # Update the run
    if add_metadata:
        run["extra"]["metadata"]["foo2"] = "baz"  # type: ignore
        run["tags"] = ["tag3"]
    langchain_client.update_run(run_id, **run)  # type: ignore
    wait_for(lambda: _get_run(run_id, has_end=True))
    updated_run = langchain_client.read_run(run_id)
    assert updated_run.metadata["foo"] == "bar"  # type: ignore
    assert updated_run.revision_id == str(revision_id)
    if add_metadata:
        updated_run.metadata["foo2"] == "baz"  # type: ignore
        assert updated_run.tags == ["tag3"]
    else:
        assert updated_run.tags == ["tag1", "tag2"]
    assert updated_run.extra["runtime"] == created_run.extra["runtime"]  # type: ignore


def test_surrogates():
    chars = "".join(chr(cp) for cp in range(0, sys.maxunicode + 1))
    trans_table = str.maketrans("", "", "")
    all_chars = chars.translate(trans_table)
    langchain_client = Client()
    langchain_client.create_run(
        name="test_run",
        inputs={
            "text": [
                "Hello\ud83d\ude00",
                "Python\ud83d\udc0d",
                "Surrogate\ud834\udd1e",
                "Example\ud83c\udf89",
                "String\ud83c\udfa7",
                "With\ud83c\udf08",
                "Surrogates\ud83d\ude0e",
                "Embedded\ud83d\udcbb",
                "In\ud83c\udf0e",
                "The\ud83d\udcd6",
                "Text\ud83d\udcac",
                "收花🙄·到",
            ]
        },
        run_type="llm",
        end_time=datetime.datetime.now(datetime.timezone.utc),
    )
    langchain_client.create_run(
        name="test_run",
        inputs={
            "text": all_chars,
        },
        run_type="llm",
        end_time=datetime.datetime.now(datetime.timezone.utc),
    )


def test_fallback_json_serialization():
    class Document(BaseModel):
        content: str

    raw_surrogates = [
        ("Hello\ud83d\ude00", "Hello😀"),
        ("Python\ud83d\udc0d", "Python🐍"),
        ("Surrogate\ud834\udd1e", "Surrogate𝄞"),
        ("Example\ud83c\udf89", "Example🎉"),
        ("String\ud83c\udfa7", "String🎧"),
        ("With\ud83c\udf08", "With🌈"),
        ("Surrogates\ud83d\ude0e", "Surrogates😎"),
        ("Embedded\ud83d\udcbb", "Embedded💻"),
        ("In\ud83c\udf0e", "In🌎"),
        ("The\ud83d\udcd6", "The📖"),
        ("Text\ud83d\udcac", "Text💬"),
        ("收花🙄·到", "收花🙄·到"),
    ]
    pydantic_surrogates = [
        (Document(content=item), expected) for item, expected in raw_surrogates
    ]

    for item, expected in raw_surrogates:
        output = dumps_json(item).decode("utf8")
        assert f'"{expected}"' == output

    for item, expected in pydantic_surrogates:
        output = dumps_json(item).decode("utf8")
        assert f'{{"content":"{expected}"}}' == output


def test_runs_stats():
    langchain_client = Client()
    # We always have stuff in the "default" project...
    stats = langchain_client.get_run_stats(project_names=["default"], run_type="llm")
    assert stats


def test_slow_run_read_multipart(
    langchain_client: Client, caplog: pytest.LogCaptureFixture
):
    myobj = {f"key_{i}": f"val_{i}" for i in range(500)}
    id_ = str(uuid.uuid4())
    current_time = datetime.datetime.now(datetime.timezone.utc).strftime(
        "%Y%m%dT%H%M%S%fZ"
    )
    run_to_create = {
        "id": id_,
        "session_name": "default",
        "name": "trace a root",
        "run_type": "chain",
        "dotted_order": f"{current_time}{id_}",
        "trace_id": id_,
        "inputs": myobj,
    }

    class CB:
        def __init__(self):
            self.called = 0
            self.start_time = None

        def __call__(self, monitor: MultipartEncoderMonitor):
            self.called += 1
            if not self.start_time:
                self.start_time = time.time()
            logger.debug(
                f"[{self.called}]: {monitor.bytes_read} bytes,"
                f" {time.time() - self.start_time:.2f} seconds"
                " elapsed",
            )
            if self.called == 1:
                time.sleep(6)

    def create_encoder(*args, **kwargs):
        encoder = MultipartEncoder(*args, **kwargs)
        encoder = MultipartEncoderMonitor(encoder, CB())
        return encoder

    with caplog.at_level(logging.WARNING, logger="langsmith.client"):
        with mock.patch(
            "langsmith.client.rqtb_multipart.MultipartEncoder", create_encoder
        ):
            langchain_client.create_run(**run_to_create)
            time.sleep(1)
            start_time = time.time()
            while time.time() - start_time < 8:
                myobj["key_1"]

        assert not caplog.records


def test_list_examples_attachments_keys(langchain_client: Client) -> None:
    """Test list_examples returns same keys with and without attachments."""
    dataset_name = "__test_list_examples_attachments" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(dataset_name=dataset_name)

    langchain_client.upload_examples_multipart(
        dataset_id=dataset.id,
        uploads=[
            ExampleUploadWithAttachments(
                inputs={"text": "hello world"},
                outputs={"response": "hi there"},
                attachments={
                    "test_file": ("text/plain", b"test content"),
                },
            )
        ],
    )

    # Get examples with attachments
    with_attachments = next(
        langchain_client.list_examples(dataset_id=dataset.id, include_attachments=True)
    )

    # Get examples without attachments
    without_attachments = next(
        langchain_client.list_examples(dataset_id=dataset.id, include_attachments=False)
    )

    with_keys = set(with_attachments.dict().keys())
    without_keys = set(without_attachments.dict().keys())
    assert with_keys == without_keys, (
        f"Keys differ when include_attachments=True vs False.\n"
        f"Only in with_attachments: {with_keys - without_keys}\n"
        f"Only in without_attachments: {without_keys - with_keys}"
    )

    langchain_client.delete_dataset(dataset_id=dataset.id)


def test_evaluate_with_attachments_multiple_evaluators(
    langchain_client: Client,
) -> None:
    """Test evaluating examples with attachments and multiple evaluators."""
    dataset_name = "__test_evaluate_attachments_multiple" + uuid4().hex[:4]

    # 1. Create dataset
    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for evals with attachments",
        data_type=DataType.kv,
    )

    # 2. Create example with attachments
    example = ExampleUploadWithAttachments(
        inputs={"question": "What is shown in the image?"},
        outputs={"answer": "test image"},
        attachments={
            "image": ("image/png", b"fake image data for testing"),
        },
    )

    langchain_client.upload_examples_multipart(dataset_id=dataset.id, uploads=[example])

    def target(inputs: Dict[str, Any], attachments: Dict[str, Any]) -> Dict[str, Any]:
        # Verify we receive the attachment data
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {"answer": "test image"}

    def evaluator_1(
        outputs: dict, reference_outputs: dict, attachments: dict
    ) -> Dict[str, Any]:
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {
            "score": float(
                reference_outputs.get("answer") == outputs.get("answer")  # type: ignore
            )
        }

    def evaluator_2(
        outputs: dict, reference_outputs: dict, attachments: dict
    ) -> Dict[str, Any]:
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {
            "score": float(
                reference_outputs.get("answer") == outputs.get("answer")  # type: ignore
            )
        }

    results = langchain_client.evaluate(
        target,
        data=dataset_name,
        evaluators=[evaluator_1, evaluator_2],
        num_repetitions=2,
    )

    for result in results:
        assert result["evaluation_results"]["results"][0].score == 1.0
        assert result["evaluation_results"]["results"][1].score == 1.0

    langchain_client.delete_dataset(dataset_name=dataset_name)


def test_evaluate_with_attachments(langchain_client: Client) -> None:
    """Test evaluating examples with attachments."""
    dataset_name = "__test_evaluate_attachments" + uuid4().hex[:4]

    # 1. Create dataset
    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for evals with attachments",
        data_type=DataType.kv,
    )

    # 2. Create example with attachments
    example = ExampleUploadWithAttachments(
        inputs={"question": "What is shown in the image?"},
        outputs={"answer": "test image"},
        attachments={
            "image": ("image/png", b"fake image data for testing"),
        },
    )

    langchain_client.upload_examples_multipart(dataset_id=dataset.id, uploads=[example])

    def target(inputs: Dict[str, Any], attachments: Dict[str, Any]) -> Dict[str, Any]:
        # Verify we receive the attachment data
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {"answer": "test image"}

    def evaluator(
        outputs: dict, reference_outputs: dict, attachments: dict
    ) -> Dict[str, Any]:
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {
            "score": float(
                reference_outputs.get("answer") == outputs.get("answer")  # type: ignore
            )
        }

    results = langchain_client.evaluate(
        target,
        data=dataset_name,
        evaluators=[evaluator],
        num_repetitions=2,
    )

    assert len(results) == 2
    for result in results:
        assert result["evaluation_results"]["results"][0].score == 1.0

    langchain_client.delete_dataset(dataset_name=dataset_name)


def test_evaluate_with_attachments_not_in_target(langchain_client: Client) -> None:
    """Test evaluating examples with attachments."""
    dataset_name = "__test_evaluate_attachments" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for evals with attachments",
        data_type=DataType.kv,
    )

    example = ExampleUploadWithAttachments(
        inputs={"question": "What is shown in the image?"},
        outputs={"answer": "test image"},
        attachments={
            "image": ("image/png", b"fake image data for testing"),
        },
    )

    langchain_client.upload_examples_multipart(dataset_id=dataset.id, uploads=[example])

    def target(inputs: Dict[str, Any]) -> Dict[str, Any]:
        return {"answer": "test image"}

    def evaluator(
        outputs: dict, reference_outputs: dict, attachments: dict
    ) -> Dict[str, Any]:
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {
            "score": float(
                reference_outputs.get("answer") == outputs.get("answer")  # type: ignore
            )
        }

    results = langchain_client.evaluate(
        target,
        data=dataset_name,
        evaluators=[evaluator],
        num_repetitions=2,
    )

    assert len(results) == 2
    for result in results:
        assert result["evaluation_results"]["results"][0].score == 1.0

    langchain_client.delete_dataset(dataset_name=dataset_name)


def test_evaluate_with_no_attachments(langchain_client: Client) -> None:
    """Test evaluating examples without attachments using a target with attachments."""
    dataset_name = "__test_evaluate_no_attachments" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for evals without attachments",
        data_type=DataType.kv,
    )

    # Create example using old way, attachments should be set to {}
    langchain_client.create_example(
        dataset_id=dataset.id,
        inputs={"question": "What is 2+2?"},
        outputs={"answer": "4"},
    )

    # Verify we can create example the new way without attachments
    example = ExampleUploadWithAttachments(
        inputs={"question": "What is 3+1?"},
        outputs={"answer": "4"},
    )
    langchain_client.upload_examples_multipart(dataset_id=dataset.id, uploads=[example])

    def target(inputs: Dict[str, Any], attachments: Dict[str, Any]) -> Dict[str, Any]:
        # Verify we receive an empty attachments dict
        assert isinstance(attachments, dict)
        assert len(attachments) == 0
        return {"answer": "4"}

    def evaluator(run: Run, example: Example) -> Dict[str, Any]:
        return {
            "score": float(
                run.outputs.get("answer") == example.outputs.get("answer")  # type: ignore
            )
        }

    results = evaluate(
        target, data=dataset_name, evaluators=[evaluator], client=langchain_client
    )

    assert len(results) == 2
    for result in results:
        assert result["evaluation_results"]["results"][0].score == 1.0

    langchain_client.delete_dataset(dataset_name=dataset_name)


async def test_aevaluate_with_attachments(langchain_client: Client) -> None:
    """Test evaluating examples with attachments."""
    dataset_name = "__test_aevaluate_attachments" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for evals with attachments",
        data_type=DataType.kv,
    )

    example = ExampleUploadWithAttachments(
        inputs={"question": "What is shown in the image?"},
        outputs={"answer": "test image"},
        attachments={
            "image": ("image/png", b"fake image data for testing"),
        },
    )

    langchain_client.upload_examples_multipart(dataset_id=dataset.id, uploads=[example])

    async def target(
        inputs: Dict[str, Any], attachments: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Verify we receive the attachment data
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {"answer": "test image"}

    async def evaluator_1(
        outputs: dict, reference_outputs: dict, attachments: dict
    ) -> Dict[str, Any]:
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {
            "score": float(
                reference_outputs.get("answer") == outputs.get("answer")  # type: ignore
            )
        }

    async def evaluator_2(
        outputs: dict, reference_outputs: dict, attachments: dict
    ) -> Dict[str, Any]:
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {
            "score": float(
                reference_outputs.get("answer") == outputs.get("answer")  # type: ignore
            )
        }

    results = await langchain_client.aevaluate(
        target,
        data=dataset_name,
        evaluators=[evaluator_1, evaluator_2],
        num_repetitions=2,
        max_concurrency=3,
    )

    assert len(results) == 2
    async for result in results:
        assert result["evaluation_results"]["results"][0].score == 1.0
        assert result["evaluation_results"]["results"][1].score == 1.0

    langchain_client.delete_dataset(dataset_name=dataset_name)


async def test_aevaluate_with_attachments_not_in_target(
    langchain_client: Client,
) -> None:
    """Test evaluating examples with attachments."""
    dataset_name = "__test_aevaluate_attachments" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for evals with attachments",
        data_type=DataType.kv,
    )

    example = ExampleUploadWithAttachments(
        inputs={"question": "What is shown in the image?"},
        outputs={"answer": "test image"},
        attachments={
            "image": ("image/png", b"fake image data for testing"),
        },
    )

    langchain_client.upload_examples_multipart(dataset_id=dataset.id, uploads=[example])

    async def target(inputs: Dict[str, Any]) -> Dict[str, Any]:
        # Verify we receive the attachment data
        return {"answer": "test image"}

    async def evaluator(
        outputs: dict, reference_outputs: dict, attachments: dict
    ) -> Dict[str, Any]:
        assert "image" in attachments
        assert "presigned_url" in attachments["image"]
        image_data = attachments["image"]["reader"]
        assert image_data.read() == b"fake image data for testing"
        return {
            "score": float(
                reference_outputs.get("answer") == outputs.get("answer")  # type: ignore
            )
        }

    results = await langchain_client.aevaluate(
        target, data=dataset_name, evaluators=[evaluator], num_repetitions=2
    )

    assert len(results) == 2
    async for result in results:
        assert result["evaluation_results"]["results"][0].score == 1.0

    langchain_client.delete_dataset(dataset_name=dataset_name)


async def test_aevaluate_with_no_attachments(langchain_client: Client) -> None:
    """Test evaluating examples without attachments using a target with attachments."""
    dataset_name = "__test_aevaluate_no_attachments" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for evals without attachments",
        data_type=DataType.kv,
    )

    # Create example using old way, attachments should be set to {}
    langchain_client.create_example(
        dataset_id=dataset.id,
        inputs={"question": "What is 2+2?"},
        outputs={"answer": "4"},
    )

    # Verify we can create example the new way without attachments
    example = ExampleUploadWithAttachments(
        inputs={"question": "What is 3+1?"},
        outputs={"answer": "4"},
    )
    langchain_client.upload_examples_multipart(dataset_id=dataset.id, uploads=[example])

    async def target(
        inputs: Dict[str, Any], attachments: Dict[str, Any]
    ) -> Dict[str, Any]:
        # Verify we receive an empty attachments dict
        assert isinstance(attachments, dict)
        assert len(attachments) == 0
        return {"answer": "4"}

    async def evaluator(run: Run, example: Example) -> Dict[str, Any]:
        return {
            "score": float(
                run.outputs.get("answer") == example.outputs.get("answer")  # type: ignore
            )
        }

    results = await aevaluate(
        target, data=dataset_name, evaluators=[evaluator], client=langchain_client
    )

    assert len(results) == 2
    async for result in results:
        assert result["evaluation_results"]["results"][0].score == 1.0

    langchain_client.delete_dataset(dataset_name=dataset_name)


def test_examples_length_validation(langchain_client: Client) -> None:
    """Test that mismatched lengths raise ValueError for create and update examples."""
    dataset_name = "__test_examples_length_validation" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(dataset_name=dataset_name)

    # Test create_examples validation
    inputs = [{"text": "hello"}, {"text": "world"}]
    outputs = [{"response": "hi"}]  # One less than inputs
    with pytest.raises(ValueError) as exc_info:
        langchain_client.create_examples(
            inputs=inputs, outputs=outputs, dataset_id=dataset.id
        )
    assert "Length of outputs (1) does not match length of inputs (2)" in str(
        exc_info.value
    )

    # Create some valid examples for testing update
    langchain_client.create_examples(
        inputs=[{"text": "hello"}, {"text": "world"}],
        outputs=[{"response": "hi"}, {"response": "earth"}],
        dataset_id=dataset.id,
    )
    example_ids = [
        example.id for example in langchain_client.list_examples(dataset_id=dataset.id)
    ]

    # Test update_examples validation
    with pytest.raises(ValueError) as exc_info:
        langchain_client.update_examples(
            example_ids=example_ids,
            inputs=[{"text": "new hello"}],  # One less than example_ids
            outputs=[{"response": "new hi"}, {"response": "new earth"}],
        )
    assert "Length of inputs (1) does not match length of examples (2)" in str(
        exc_info.value
    )

    # Clean up
    langchain_client.delete_dataset(dataset_id=dataset.id)


def test_update_example_with_attachments_operations(langchain_client: Client) -> None:
    """Test updating an example with attachment operations."""
    dataset_name = "__test_update_example_attachments" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(
        dataset_name=dataset_name,
        description="Test dataset for updating example attachments",
    )
    example_id = uuid4()
    # Create example with attachments
    example = ExampleUploadWithAttachments(
        id=example_id,
        inputs={"query": "What's in this image?"},
        outputs={"answer": "A test image"},
        attachments={
            "image1": ("image/png", b"fake image data 1"),
            "image2": ("image/png", b"fake image data 2"),
        },
    )
    langchain_client.upload_examples_multipart(dataset_id=dataset.id, uploads=[example])

    # Update example with attachment operations to rename and retain attachments
    attachments_operations = AttachmentsOperations(
        rename={"image1": "renamed_image"},
        retain=["image2"],  # Only keep the renamed image1, drop image2
    )

    langchain_client.update_example(
        example_id=example_id,
        attachments_operations=attachments_operations,
    )

    # Verify the update
    retrieved_example = langchain_client.read_example(
        example_id=example_id,
    )

    # Check that only the renamed attachment exists
    assert len(retrieved_example.attachments) == 2
    assert "renamed_image" in retrieved_example.attachments
    assert "image2" in retrieved_example.attachments
    assert "image1" not in retrieved_example.attachments
    assert (
        retrieved_example.attachments["image2"]["reader"].read() == b"fake image data 2"
    )
    assert (
        retrieved_example.attachments["renamed_image"]["reader"].read()
        == b"fake image data 1"
    )

    # Clean up
    langchain_client.delete_dataset(dataset_id=dataset.id)


def test_bulk_update_examples_with_attachments_operations(
    langchain_client: Client,
) -> None:
    """Test bulk updating examples with attachment operations."""
    dataset_name = "__test_bulk_update_attachments" + uuid4().hex[:4]
    dataset = langchain_client.create_dataset(
        dataset_name=dataset_name,
        description="Test dataset for bulk updating example attachments",
    )

    example_id1, example_id2 = uuid4(), uuid4()
    # Create two examples with attachments
    example1 = ExampleUploadWithAttachments(
        id=example_id1,
        inputs={"query": "What's in this image?"},
        outputs={"answer": "A test image 1"},
        attachments={
            "image1": ("image/png", b"fake image data 1"),
            "extra": ("text/plain", b"extra data"),
        },
    )
    example2 = ExampleUploadWithAttachments(
        id=example_id2,
        inputs={"query": "What's in this image?"},
        outputs={"answer": "A test image 2"},
        attachments={
            "image2": ("image/png", b"fake image data 2"),
            "extra": ("text/plain", b"extra data"),
        },
    )

    created_examples = langchain_client.upload_examples_multipart(
        dataset_id=dataset.id,
        uploads=[example1, example2],
    )
    assert len(created_examples["example_ids"]) == 2
    assert str(example_id1) in created_examples["example_ids"]
    assert str(example_id2) in created_examples["example_ids"]

    # Update both examples with different attachment operations
    attachments_operations = [
        AttachmentsOperations(
            rename={"image1": "renamed_image1"},
        ),
        AttachmentsOperations(retain=["extra"]),
    ]

    langchain_client.update_examples(
        example_ids=[example_id1, example_id2],
        attachments_operations=attachments_operations,
    )

    # Verify the updates
    updated_examples = list(
        langchain_client.list_examples(
            dataset_id=dataset.id,
            example_ids=[example_id1, example_id2],
            include_attachments=True,
        )
    )

    updated_example_1 = next(ex for ex in updated_examples if ex.id == example_id1)
    updated_example_2 = next(ex for ex in updated_examples if ex.id == example_id2)
    # Check first example
    assert len(updated_example_1.attachments) == 1
    assert "renamed_image1" in updated_example_1.attachments
    assert "extra" not in updated_example_1.attachments

    # Check second example
    assert len(updated_example_2.attachments) == 1
    assert "extra" in updated_example_2.attachments
    assert "image2" not in updated_example_2.attachments

    # Check attachment data
    assert (
        updated_example_1.attachments["renamed_image1"]["reader"].read()
        == b"fake image data 1"
    )
    assert updated_example_2.attachments["extra"]["reader"].read() == b"extra data"

    # Clean up
    langchain_client.delete_dataset(dataset_id=dataset.id)


def test_update_examples_multipart(langchain_client: Client) -> None:
    """Test updating examples with attachments via multipart endpoint."""
    dataset_name = "__test_update_examples_multipart" + uuid4().hex[:4]
    if langchain_client.has_dataset(dataset_name=dataset_name):
        langchain_client.delete_dataset(dataset_name=dataset_name)

    dataset = langchain_client.create_dataset(
        dataset_name,
        description="Test dataset for multipart example updates",
        data_type=DataType.kv,
    )
    example_ids = [uuid4() for _ in range(2)]

    # First create some examples with attachments
    example_1 = ExampleUploadWithAttachments(
        id=example_ids[0],
        inputs={"text": "hello world"},
        attachments={
            "file1": ("text/plain", b"original content 1"),
            "file2": ("text/plain", b"original content 2"),
        },
    )

    example_2 = ExampleUploadWithAttachments(
        id=example_ids[1],
        inputs={"text": "second example"},
        attachments={
            "file3": ("text/plain", b"original content 3"),
            "file4": ("text/plain", b"original content 4"),
        },
    )

    created_examples = langchain_client.upload_examples_multipart(
        dataset_id=dataset.id, uploads=[example_1, example_2]
    )
    assert created_examples["count"] == 2

    # Now create update operations
    update_1 = ExampleUpdateWithAttachments(
        id=example_ids[0],
        inputs={"text": "updated hello world"},
        attachments={
            "new_file1": ("text/plain", b"new content 1"),
        },
        attachments_operations=AttachmentsOperations(
            retain=["file1"],
        ),
    )

    update_2 = ExampleUpdateWithAttachments(
        id=example_ids[1],
        inputs={"text": "updated second example"},
        attachments={
            "new_file2": ("text/plain", b"new content 2"),
        },
        attachments_operations=AttachmentsOperations(retain=["file3"]),
    )

    # Test updating multiple examples at once
    updated_examples = langchain_client.update_examples_multipart(
        dataset_id=dataset.id, updates=[update_1, update_2]
    )
    assert updated_examples["count"] == 2

    # Verify the updates
    updated = list(
        langchain_client.list_examples(
            dataset_id=dataset.id,
            include_attachments=True,
        )
    )

    # Verify first example updates
    example_1_updated = next(ex for ex in updated if ex.id == example_ids[0])
    assert example_1_updated.inputs["text"] == "updated hello world"
    assert "file1" in example_1_updated.attachments
    assert "new_file1" in example_1_updated.attachments
    assert "file2" not in example_1_updated.attachments
    assert (
        example_1_updated.attachments["new_file1"]["reader"].read() == b"new content 1"
    )
    assert (
        example_1_updated.attachments["file1"]["reader"].read() == b"original content 1"
    )

    # Verify second example updates
    example_2_updated = next(ex for ex in updated if ex.id == example_ids[1])
    assert example_2_updated.inputs["text"] == "updated second example"
    assert "file3" in example_2_updated.attachments
    assert "new_file2" in example_2_updated.attachments
    assert "file4" not in example_2_updated.attachments
    assert "file3" in example_2_updated.attachments
    assert "new_file2" in example_2_updated.attachments
    assert "file4" not in example_2_updated.attachments
    assert (
        example_2_updated.attachments["file3"]["reader"].read() == b"original content 3"
    )
    assert (
        example_2_updated.attachments["new_file2"]["reader"].read() == b"new content 2"
    )

    # Test updating non-existent example doesn't do anything
    response = langchain_client.update_examples_multipart(
        dataset_id=dataset.id,
        updates=[
            ExampleUpdateWithAttachments(
                id=uuid4(),
                inputs={"text": "should fail"},
            )
        ],
    )
    assert response["count"] == 0

    # Test new attachments have priority
    response = langchain_client.update_examples_multipart(
        dataset_id=dataset.id,
        updates=[
            ExampleUpdateWithAttachments(
                id=example_ids[0],
                attachments={
                    "renamed_file1": ("text/plain", b"new content 1"),
                },
                attachments_operations=AttachmentsOperations(
                    retain=["renamed_file1"],
                ),
            )
        ],
    )
    assert response["count"] == 1
    example_1_updated = langchain_client.read_example(example_ids[0])
    assert list(example_1_updated.attachments.keys()) == ["renamed_file1"]
    assert (
        example_1_updated.attachments["renamed_file1"]["reader"].read()
        == b"new content 1"
    )

    # Test new attachments have priority
    response = langchain_client.update_examples_multipart(
        dataset_id=dataset.id,
        updates=[
            ExampleUpdateWithAttachments(
                id=example_ids[0],
                attachments={
                    "foo": ("text/plain", b"new content 1"),
                },
                attachments_operations=AttachmentsOperations(
                    rename={"renamed_file1": "foo"},
                ),
            )
        ],
    )
    assert response["count"] == 1
    example_1_updated = langchain_client.read_example(example_ids[0])
    assert list(example_1_updated.attachments.keys()) == ["foo"]

    # Clean up
    langchain_client.delete_dataset(dataset_id=dataset.id)


def test_annotation_queue_crud(langchain_client: Client):
    """Test basic CRUD operations for annotation queues."""
    queue_name = f"test_queue_{uuid.uuid4().hex[:8]}"
    queue_id = uuid.uuid4()

    # Test creation
    queue = langchain_client.create_annotation_queue(
        name=queue_name, description="Test queue", queue_id=queue_id
    )
    assert queue.name == queue_name
    assert queue.id == queue_id

    # Test reading
    read_queue = langchain_client.read_annotation_queue(queue_id)
    assert read_queue.id == queue_id
    assert read_queue.name == queue_name

    # Test updating
    new_name = f"updated_{queue_name}"
    langchain_client.update_annotation_queue(
        queue_id=queue_id, name=new_name, description="Updated description"
    )

    updated_queue = langchain_client.read_annotation_queue(queue_id)
    assert updated_queue.name == new_name

    # Test deletion
    langchain_client.delete_annotation_queue(queue_id)

    # Verify deletion
    queues = list(langchain_client.list_annotation_queues(queue_ids=[queue_id]))
    assert len(queues) == 0


def test_list_annotation_queues(langchain_client: Client):
    """Test listing and filtering annotation queues."""
    queue_names = [f"test_queue_{i}_{uuid.uuid4().hex[:8]}" for i in range(3)]
    queue_ids = []

    try:
        # Create test queues
        for name in queue_names:
            queue = langchain_client.create_annotation_queue(
                name=name, description="Test queue"
            )
            queue_ids.append(queue.id)

        # Test listing with various filters
        queues = list(
            langchain_client.list_annotation_queues(queue_ids=queue_ids[:2], limit=2)
        )
        assert len(queues) == 2

        # Test name filter
        queues = list(langchain_client.list_annotation_queues(name=queue_names[0]))
        assert len(queues) == 1
        assert queues[0].name == queue_names[0]

        # Test name_contains filter
        queues = list(
            langchain_client.list_annotation_queues(name_contains="test_queue")
        )
        assert len(queues) >= 3  # Could be more if other tests left queues

    finally:
        # Clean up
        for queue_id in queue_ids:
            langchain_client.delete_annotation_queue(queue_id)


def test_annotation_queue_runs(langchain_client: Client):
    """Test managing runs within an annotation queue."""
    queue_name = f"test_queue_{uuid.uuid4().hex[:8]}"
    project_name = f"test_project_{uuid.uuid4().hex[:8]}"

    # Create a queue
    queue = langchain_client.create_annotation_queue(
        name=queue_name, description="Test queue"
    )

    # Create some test runs
    run_ids = [uuid.uuid4() for _ in range(3)]
    for i in range(3):
        langchain_client.create_run(
            name=f"test_run_{i}",
            inputs={"input": f"test_{i}"},
            run_type="llm",
            project_name=project_name,
            start_time=datetime.datetime.now(datetime.timezone.utc),
            id=run_ids[i],
        )

    def _get_run(run_id: ID_TYPE, has_end: bool = False) -> bool:
        try:
            r = langchain_client.read_run(run_id)  # type: ignore
            if has_end:
                return r.end_time is not None
            return True
        except LangSmithError:
            return False

    wait_for(lambda: _get_run(run_ids[0]))
    wait_for(lambda: _get_run(run_ids[1]))
    wait_for(lambda: _get_run(run_ids[2]))
    # Add runs to queue
    langchain_client.add_runs_to_annotation_queue(queue_id=queue.id, run_ids=run_ids)

    # Test getting run at index
    run_info = langchain_client.get_run_from_annotation_queue(
        queue_id=queue.id, index=0
    )
    assert run_info.id in run_ids

    # Test deleting a run from queue
    langchain_client.delete_run_from_annotation_queue(
        queue_id=queue.id, run_id=run_ids[2]
    )

    # Test that runs are deleted
    run = langchain_client.get_run_from_annotation_queue(queue_id=queue.id, index=0)
    assert run.id == run_ids[1]

    # Clean up
    langchain_client.delete_annotation_queue(queue.id)
