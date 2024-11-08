import asyncio
import functools
import logging
import time
from contextlib import contextmanager
from typing import Callable, Sequence, Tuple, TypeVar

import pytest

from langsmith import Client, aevaluate, evaluate, expect, test
from langsmith.evaluation import EvaluationResult, EvaluationResults
from langsmith.schemas import Example, Run

T = TypeVar("T")


@contextmanager
def suppress_warnings():
    logger = logging.getLogger()
    current_level = logger.level
    logger.setLevel(logging.CRITICAL)
    try:
        yield
    finally:
        logger.setLevel(current_level)


def wait_for(
    condition: Callable[[], Tuple[T, bool]],
    max_sleep_time: int = 120,
    sleep_time: int = 3,
) -> T:
    """Wait for a condition to be true."""
    start_time = time.time()
    last_e = None
    while time.time() - start_time < max_sleep_time:
        try:
            res, cond = condition()
            if cond:
                return res
        except Exception as e:
            last_e = e
            time.sleep(sleep_time)
    total_time = time.time() - start_time
    if last_e is not None:
        raise last_e
    raise ValueError(f"Callable did not return within {total_time}")


async def test_error_handling_evaluators():
    client = Client()
    _ = client.clone_public_dataset(
        "https://smith.langchain.com/public/419dcab2-1d66-4b94-8901-0357ead390df/d"
    )
    dataset_name = "Evaluate Examples"

    # Case 1: Normal dictionary return
    def error_dict_evaluator(run: Run, example: Example):
        if True:  # This condition ensures the error is always raised
            raise ValueError("Error in dict evaluator")
        return {"key": "dict_key", "score": 1}

    # Case 2: EvaluationResult return
    def error_evaluation_result(run: Run, example: Example):
        if True:  # This condition ensures the error is always raised
            raise ValueError("Error in EvaluationResult evaluator")
        return EvaluationResult(key="eval_result_key", score=1)

    # Case 3: EvaluationResults return
    def error_evaluation_results(run: Run, example: Example):
        if True:  # This condition ensures the error is always raised
            raise ValueError("Error in EvaluationResults evaluator")
        return EvaluationResults(
            results=[
                EvaluationResult(key="eval_results_key1", score=1),
                EvaluationResult(key="eval_results_key2", score=2),
            ]
        )

    # Case 4: Dictionary without 'key' field
    def error_dict_no_key(run: Run, example: Example):
        if True:  # This condition ensures the error is always raised
            raise ValueError("Error in dict without key evaluator")
        return {"score": 1}

    # Case 5: dict-style results
    def error_evaluation_results_dict(run: Run, example: Example):
        if True:  # This condition ensures the error is always raised
            raise ValueError("Error in EvaluationResults dict evaluator")

        return {
            "results": [
                dict(key="eval_results_dict_key1", score=1),
                {"key": "eval_results_dict_key2", "score": 2},
                EvaluationResult(key="eval_results_dict_key3", score=3),
            ]
        }

    def predict(inputs: dict) -> dict:
        return {"output": "Yes"}

    with suppress_warnings():
        sync_results = evaluate(
            predict,
            data=client.list_examples(
                dataset_name=dataset_name,
                as_of="test_version",
            ),
            evaluators=[
                error_dict_evaluator,
                error_evaluation_result,
                error_evaluation_results,
                error_dict_no_key,
                error_evaluation_results_dict,
            ],
            max_concurrency=1,  # To ensure deterministic order
        )

    assert len(sync_results) == 10  # Assuming 10 examples in the dataset

    def check_results(results):
        for result in results:
            eval_results = result["evaluation_results"]["results"]
            assert len(eval_results) == 8

            # Check error handling for each evaluator
            assert eval_results[0].key == "dict_key"
            assert "Error in dict evaluator" in eval_results[0].comment
            assert eval_results[0].extra.get("error") is True

            assert eval_results[1].key == "eval_result_key"
            assert "Error in EvaluationResult evaluator" in eval_results[1].comment
            assert eval_results[1].extra.get("error") is True

            assert eval_results[2].key == "eval_results_key1"
            assert "Error in EvaluationResults evaluator" in eval_results[2].comment
            assert eval_results[2].extra.get("error") is True

            assert eval_results[3].key == "eval_results_key2"
            assert "Error in EvaluationResults evaluator" in eval_results[3].comment
            assert eval_results[3].extra.get("error") is True

            assert eval_results[4].key == "error_dict_no_key"
            assert "Error in dict without key evaluator" in eval_results[4].comment
            assert eval_results[4].extra.get("error") is True

            assert eval_results[5].key == "eval_results_dict_key1"
            assert (
                "Error in EvaluationResults dict evaluator" in eval_results[5].comment
            )
            assert eval_results[5].extra.get("error") is True

            assert eval_results[6].key == "eval_results_dict_key2"
            assert (
                "Error in EvaluationResults dict evaluator" in eval_results[6].comment
            )
            assert eval_results[6].extra.get("error") is True

            assert eval_results[7].key == "eval_results_dict_key3"
            assert (
                "Error in EvaluationResults dict evaluator" in eval_results[7].comment
            )
            assert eval_results[7].extra.get("error") is True

    check_results(sync_results)

    async def apredict(inputs: dict):
        return predict(inputs)

    with suppress_warnings():
        async_results = await aevaluate(
            apredict,
            data=list(
                client.list_examples(
                    dataset_name=dataset_name,
                    as_of="test_version",
                )
            ),
            evaluators=[
                error_dict_evaluator,
                error_evaluation_result,
                error_evaluation_results,
                error_dict_no_key,
                error_evaluation_results_dict,
            ],
            max_concurrency=1,  # To ensure deterministic order
        )

    assert len(async_results) == 10  # Assuming 10 examples in the dataset
    check_results([res async for res in async_results])


@functools.lru_cache(maxsize=1)
def _has_pandas() -> bool:
    try:
        import pandas  # noqa

        return True

    except Exception:
        return False


def test_evaluate():
    client = Client()
    _ = client.clone_public_dataset(
        "https://smith.langchain.com/public/419dcab2-1d66-4b94-8901-0357ead390df/d"
    )
    dataset_name = "Evaluate Examples"

    def accuracy(run: Run, example: Example):
        pred = run.outputs["output"]  # type: ignore
        expected = example.outputs["answer"]  # type: ignore
        return {"score": expected.lower() == pred.lower()}

    def precision(runs: Sequence[Run], examples: Sequence[Example]):
        predictions = [run.outputs["output"].lower() for run in runs]  # type: ignore
        expected = [example.outputs["answer"].lower() for example in examples]  # type: ignore
        tp = sum([p == e for p, e in zip(predictions, expected) if p == "yes"])
        fp = sum([p == "yes" and e == "no" for p, e in zip(predictions, expected)])
        return {"score": tp / (tp + fp)}

    def predict(inputs: dict) -> dict:
        return {"output": "Yes"}

    results = evaluate(
        predict,
        data=client.list_examples(dataset_name=dataset_name, as_of="test_version"),
        evaluators=[accuracy],
        summary_evaluators=[precision],
        description="My sync experiment",
        metadata={
            "my-prompt-version": "abcd-1234",
            "function": "evaluate",
        },
        num_repetitions=3,
    )
    assert len(results) == 30
    if _has_pandas():
        df = results.to_pandas()
        assert len(df) == 30
        assert set(df.columns) == {
            "inputs.context",
            "inputs.question",
            "outputs.output",
            "error",
            "reference.answer",
            "feedback.accuracy",
            "execution_time",
            "example_id",
            "id",
        }
    examples = client.list_examples(dataset_name=dataset_name, as_of="test_version")
    for example in examples:
        assert len([r for r in results if r["example"].id == example.id]) == 3

    # Run it again with the existing project
    results2 = evaluate(
        predict,
        data=client.list_examples(dataset_name=dataset_name, as_of="test_version"),
        evaluators=[accuracy],
        summary_evaluators=[precision],
        experiment=results.experiment_name,
    )
    assert len(results2) == 10

    # ... and again with the object
    experiment = client.read_project(project_name=results.experiment_name)
    results3 = evaluate(
        predict,
        data=client.list_examples(dataset_name=dataset_name, as_of="test_version"),
        evaluators=[accuracy],
        summary_evaluators=[precision],
        experiment=experiment,
    )
    assert len(results3) == 10

    # ... and again with the ID
    results4 = evaluate(
        predict,
        data=client.list_examples(dataset_name=dataset_name, as_of="test_version"),
        evaluators=[accuracy],
        summary_evaluators=[precision],
        experiment=str(experiment.id),
    )
    assert len(results4) == 10


async def test_aevaluate():
    client = Client()
    _ = client.clone_public_dataset(
        "https://smith.langchain.com/public/419dcab2-1d66-4b94-8901-0357ead390df/d"
    )
    dataset_name = "Evaluate Examples"

    def accuracy(run: Run, example: Example):
        pred = run.outputs["output"]  # type: ignore
        expected = example.outputs["answer"]  # type: ignore
        return {"score": expected.lower() == pred.lower()}

    async def slow_accuracy(run: Run, example: Example):
        pred = run.outputs["output"]  # type: ignore
        expected = example.outputs["answer"]  # type: ignore
        await asyncio.sleep(5)
        return {"score": expected.lower() == pred.lower()}

    def precision(runs: Sequence[Run], examples: Sequence[Example]):
        predictions = [run.outputs["output"].lower() for run in runs]  # type: ignore
        expected = [example.outputs["answer"].lower() for example in examples]  # type: ignore
        tp = sum([p == e for p, e in zip(predictions, expected) if p == "yes"])
        fp = sum([p == "yes" and e == "no" for p, e in zip(predictions, expected)])
        return {"score": tp / (tp + fp)}

    async def apredict(inputs: dict) -> dict:
        await asyncio.sleep(0.1)
        return {"output": "Yes"}

    results = await aevaluate(
        apredict,
        data=client.list_examples(dataset_name=dataset_name, as_of="test_version"),
        evaluators=[accuracy, slow_accuracy],
        summary_evaluators=[precision],
        experiment_prefix="My Experiment",
        description="My Experiment Description",
        metadata={
            "my-prompt-version": "abcd-1234",
            "function": "aevaluate",
        },
        num_repetitions=2,
    )
    assert len(results) == 20
    if _has_pandas():
        df = results.to_pandas()
        assert len(df) == 20
    examples = client.list_examples(dataset_name=dataset_name, as_of="test_version")
    all_results = [r async for r in results]
    all_results_again = [r async for r in results]
    assert all_results == all_results_again
    all_examples = []
    for example in examples:
        count = 0
        for r in all_results:
            if r["run"].reference_example_id == example.id:
                count += 1
        assert count == 2
        all_examples.append(example)

    # Wait for there to be 2x runs vs. examples
    def check_run_count():
        current_runs = list(
            client.list_runs(project_name=results.experiment_name, is_root=True)
        )
        for r in current_runs:
            assert "accuracy" in r.feedback_stats
            assert "slow_accuracy" in r.feedback_stats
        return current_runs, len(current_runs) == 2 * len(all_examples)

    final_runs = wait_for(check_run_count, max_sleep_time=60, sleep_time=2)

    assert len(final_runs) == 2 * len(
        all_examples
    ), f"Expected {2 * len(all_examples)} runs, but got {len(final_runs)}"

    # Run it again with the existing project
    results2 = await aevaluate(
        apredict,
        data=client.list_examples(dataset_name=dataset_name, as_of="test_version"),
        evaluators=[accuracy],
        summary_evaluators=[precision],
        experiment=results.experiment_name,
    )
    assert len(results2) == 10

    # ... and again with the object
    experiment = client.read_project(project_name=results.experiment_name)
    results3 = await aevaluate(
        apredict,
        data=client.list_examples(dataset_name=dataset_name, as_of="test_version"),
        evaluators=[accuracy],
        summary_evaluators=[precision],
        experiment=experiment,
    )
    assert len(results3) == 10

    # ... and again with the ID
    results4 = await aevaluate(
        apredict,
        data=client.list_examples(dataset_name=dataset_name, as_of="test_version"),
        evaluators=[accuracy],
        summary_evaluators=[precision],
        experiment=str(experiment.id),
    )
    assert len(results4) == 10


@test
def test_foo():
    expect(3 + 4).to_equal(7)


@pytest.fixture
def some_input():
    return "Some input"


@pytest.fixture
def expected_output():
    return "input"


@test(output_keys=["expected_output"])
def test_bar(some_input: str, expected_output: str):
    expect(some_input).to_contain(expected_output)


@test
async def test_baz():
    await asyncio.sleep(0.1)
    expect(3 + 4).to_equal(7)
    return 7


@test
@pytest.mark.parametrize("x, y", [(1, 2), (2, 3)])
def test_foo_parametrized(x, y):
    expect(x + y).to_be_greater_than(0)
    return x + y


@test(output_keys=["z"])
@pytest.mark.parametrize("x, y, z", [(1, 2, 3), (2, 3, 5)])
def test_bar_parametrized(x, y, z):
    expect(x + y).to_equal(z)
    return {"z": x + y}


@test(test_suite_name="tests.evaluation.test_evaluation::test_foo_async_parametrized")
@pytest.mark.parametrize("x, y", [(1, 2), (2, 3)])
async def test_foo_async_parametrized(x, y):
    await asyncio.sleep(0.1)
    expect(x + y).to_be_greater_than(0)
    return x + y


@test(output_keys=["z"])
@pytest.mark.parametrize("x, y, z", [(1, 2, 3), (2, 3, 5)])
async def test_bar_async_parametrized(x, y, z):
    await asyncio.sleep(0.1)
    expect(x + y).to_equal(z)
    return {"z": x + y}


@test
def test_pytest_skip():
    pytest.skip("Skip this test")


@test
async def test_async_pytest_skip():
    pytest.skip("Skip this test")


async def test_aevaluate_good_error():
    client = Client()
    ds_name = "__Empty Dataset Do Not Modify"
    if not client.has_dataset(dataset_name=ds_name):
        client.create_dataset(dataset_name=ds_name)

    async def predict(inputs: dict):
        return {}

    match_val = "No examples found in the dataset."
    with pytest.raises(ValueError, match=match_val):
        await aevaluate(
            predict,
            data=ds_name,
        )

    with pytest.raises(ValueError, match=match_val):
        await aevaluate(
            predict,
            data=[],
        )
    with pytest.raises(ValueError, match=match_val):
        await aevaluate(
            predict,
            data=(_ for _ in range(0)),
        )
