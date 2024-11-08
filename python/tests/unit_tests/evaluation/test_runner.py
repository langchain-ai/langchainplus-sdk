"""Test the eval runner."""

import asyncio
import functools
import itertools
import json
import random
import sys
import time
import uuid
from datetime import datetime, timezone
from threading import Lock
from typing import Callable, List
from unittest import mock
from unittest.mock import MagicMock

import pytest

from langsmith import evaluate
from langsmith import schemas as ls_schemas
from langsmith.client import Client
from langsmith.evaluation._arunner import aevaluate, aevaluate_existing
from langsmith.evaluation._runner import evaluate_existing


class FakeRequest:
    def __init__(self, ds_id, ds_name, ds_examples, tenant_id):
        self.created_session = None
        self.runs = {}
        self.should_fail = False
        self.ds_id = ds_id
        self.ds_name = ds_name
        self.ds_examples = ds_examples
        self.tenant_id = tenant_id

    def request(self, verb: str, endpoint: str, *args, **kwargs):
        if verb == "GET":
            if endpoint == "http://localhost:1984/datasets":
                res = MagicMock()
                res.json.return_value = {
                    "id": self.ds_id,
                    "created_at": "2021-09-01T00:00:00Z",
                    "name": self.ds_name,
                }
                return res
            elif endpoint == "http://localhost:1984/examples":
                res = MagicMock()
                res.json.return_value = [e.dict() for e in self.ds_examples]
                return res
            elif endpoint == "http://localhost:1984/sessions":
                res = {}  # type: ignore
                if kwargs["params"]["name"] == self.created_session["name"]:  # type: ignore
                    res = self.created_session  # type: ignore
                response = MagicMock()
                response.json.return_value = res
                return response

            else:
                self.should_fail = True
                raise ValueError(f"Unknown endpoint: {endpoint}")
        elif verb == "POST":
            if endpoint == "http://localhost:1984/sessions":
                self.created_session = json.loads(kwargs["data"]) | {
                    "tenant_id": self.tenant_id
                }
                response = MagicMock()
                response.json.return_value = self.created_session
                return response
            elif endpoint == "http://localhost:1984/runs/batch":
                loaded_runs = json.loads(kwargs["data"])
                posted = loaded_runs.get("post", [])
                patched = loaded_runs.get("patch", [])
                for p in posted:
                    self.runs[p["id"]] = p
                for p in patched:
                    self.runs[p["id"]].update(p)
                response = MagicMock()
                return response
            elif endpoint == "http://localhost:1984/runs/query":
                res = MagicMock()
                res.json.return_value = {
                    "runs": [
                        r for r in self.runs.values() if "reference_example_id" in r
                    ]
                }
                return res
            elif endpoint == "http://localhost:1984/feedback":
                response = MagicMock()
                response.json.return_value = {}
                return response

            else:
                raise ValueError(f"Unknown endpoint: {endpoint}")
        elif verb == "PATCH":
            if (
                endpoint
                == f"http://localhost:1984/sessions/{self.created_session['id']}"
            ):  # type: ignore
                updates = json.loads(kwargs["data"])
                self.created_session.update({k: v for k, v in updates.items() if v})  # type: ignore
                response = MagicMock()
                response.json.return_value = self.created_session
                return response
            else:
                self.should_fail = True
                raise ValueError(f"Unknown endpoint: {endpoint}")
        else:
            self.should_fail = True
            raise ValueError(f"Unknown verb: {verb}, {endpoint}")


def _wait_until(condition: Callable, timeout: int = 8):
    start = time.time()
    while time.time() - start < timeout:
        if condition():
            return
        time.sleep(0.1)
    raise TimeoutError("Condition not met")


@pytest.mark.skipif(sys.version_info < (3, 9), reason="requires python3.9 or higher")
@pytest.mark.parametrize("blocking", [False, True])
def test_evaluate_results(blocking: bool) -> None:
    session = mock.Mock()
    ds_name = "my-dataset"
    ds_id = "00886375-eb2a-4038-9032-efff60309896"

    def _create_example(idx: int) -> ls_schemas.Example:
        return ls_schemas.Example(
            id=uuid.uuid4(),
            inputs={"in": idx},
            outputs={"answer": idx + 1},
            dataset_id=ds_id,
            created_at=datetime.now(timezone.utc),
        )

    SPLIT_SIZE = 3
    NUM_REPETITIONS = 4
    ds_examples = [_create_example(i) for i in range(10)]
    dev_split = random.sample(ds_examples, SPLIT_SIZE)
    tenant_id = str(uuid.uuid4())
    fake_request = FakeRequest(ds_id, ds_name, ds_examples, tenant_id)
    session.request = fake_request.request
    client = Client(
        api_url="http://localhost:1984",
        api_key="123",
        session=session,
        info=ls_schemas.LangSmithInfo(
            batch_ingest_config=ls_schemas.BatchIngestConfig(
                size_limit_bytes=None,  # Note this field is not used here
                size_limit=100,
                scale_up_nthreads_limit=16,
                scale_up_qsize_trigger=1000,
                scale_down_nempty_trigger=4,
            )
        ),
    )
    client._tenant_id = tenant_id  # type: ignore

    ordering_of_stuff: List[str] = []
    locked = False

    lock = Lock()
    slow_index = None

    def predict(inputs: dict) -> dict:
        nonlocal locked
        nonlocal slow_index
        if len(ordering_of_stuff) > 2 and not locked:
            with lock:
                if len(ordering_of_stuff) > 2 and not locked:
                    locked = True
                    time.sleep(3)
                    slow_index = len(ordering_of_stuff)
                    ordering_of_stuff.append("predict")
                else:
                    ordering_of_stuff.append("predict")

        else:
            ordering_of_stuff.append("predict")
        return {"output": inputs["in"] + 1}

    def score_value_first(run, example):
        ordering_of_stuff.append("evaluate")
        return {"score": 0.3}

    results = evaluate(
        predict,
        client=client,
        data=dev_split,
        evaluators=[score_value_first],
        num_repetitions=NUM_REPETITIONS,
        blocking=blocking,
    )
    if not blocking:
        deltas = []
        last = None
        start = time.time()
        now = start
        for _ in results:
            now = time.time()
            deltas.append((now - last) if last is not None else 0)  # type: ignore
            last = now
        assert now - start > 1.5
        # Essentially we want to check that 1 delay is > 1.5s and the rest are < 0.1s
        assert len(deltas) == SPLIT_SIZE * NUM_REPETITIONS
        assert slow_index is not None

        total_quick = sum([d < 0.5 for d in deltas])
        total_slow = sum([d > 0.5 for d in deltas])
        tolerance = 3
        assert total_slow < tolerance
        assert total_quick > (SPLIT_SIZE * NUM_REPETITIONS - 1) - tolerance
    all_results = []
    for r in results:
        assert r["run"].outputs["output"] == r["example"].inputs["in"] + 1  # type: ignore
        assert set(r["run"].outputs.keys()) == {"output"}  # type: ignore
        all_results.append(r)
        if len(all_results) == 2:
            # Ensure we aren't resetting some stateful thing on the results obj
            [r for r in results]
    assert len(all_results)

    assert fake_request.created_session
    _wait_until(lambda: fake_request.runs)
    N_PREDS = SPLIT_SIZE * NUM_REPETITIONS
    _wait_until(lambda: len(ordering_of_stuff) == N_PREDS * 2)
    _wait_until(lambda: slow_index is not None)
    # Want it to be interleaved
    assert ordering_of_stuff != ["predict"] * N_PREDS + ["evaluate"] * N_PREDS

    # It's delayed, so it'll be the penultimate event
    # Will run all other preds and evals, then this, then the last eval
    assert slow_index == (N_PREDS * 2) - 2

    def score_value(run, example):
        return {"score": 0.7}

    ex_results = evaluate_existing(
        fake_request.created_session["name"], evaluators=[score_value], client=client
    )
    second_item = next(itertools.islice(iter(ex_results), 1, 2))
    first_list = list(ex_results)
    second_list = list(ex_results)
    second_item_after = next(itertools.islice(iter(ex_results), 1, 2))
    assert len(first_list) == len(second_list) == SPLIT_SIZE * NUM_REPETITIONS
    assert first_list == second_list
    assert second_item == second_item_after
    dev_xample_ids = [e.id for e in dev_split]
    for r in ex_results:
        assert r["example"].id in dev_xample_ids
        assert r["evaluation_results"]["results"][0].score == 0.7
        assert r["run"].reference_example_id in dev_xample_ids
    assert not fake_request.should_fail


def test_evaluate_raises_for_async():
    async def my_func(inputs: dict):
        pass

    match = "Async functions are not supported by"
    with pytest.raises(ValueError, match=match):
        evaluate(my_func, data="foo")

    async def my_other_func(inputs: dict, other_val: int):
        pass

    with pytest.raises(ValueError, match=match):
        evaluate(functools.partial(my_other_func, other_val=3), data="foo")

    try:
        from langchain_core.runnables import RunnableLambda
    except ImportError:
        pytest.skip("langchain-core not installed.")

    @RunnableLambda
    def foo(inputs: dict):
        return "bar"

    with pytest.raises(ValueError, match=match):
        evaluate(foo.ainvoke, data="foo")
    if sys.version_info < (3, 10):
        return
    with pytest.raises(ValueError, match=match):
        evaluate(functools.partial(foo.ainvoke, inputs={"foo": "bar"}), data="foo")


@pytest.mark.skipif(sys.version_info < (3, 9), reason="requires python3.9 or higher")
@pytest.mark.parametrize("blocking", [False, True])
async def test_aevaluate_results(blocking: bool) -> None:
    session = mock.Mock()
    ds_name = "my-dataset"
    ds_id = "00886375-eb2a-4038-9032-efff60309896"

    def _create_example(idx: int) -> ls_schemas.Example:
        return ls_schemas.Example(
            id=uuid.uuid4(),
            inputs={"in": idx},
            outputs={"answer": idx + 1},
            dataset_id=ds_id,
            created_at=datetime.now(timezone.utc),
        )

    SPLIT_SIZE = 3
    NUM_REPETITIONS = 4
    ds_examples = [_create_example(i) for i in range(10)]
    dev_split = random.sample(ds_examples, SPLIT_SIZE)
    tenant_id = str(uuid.uuid4())
    fake_request = FakeRequest(ds_id, ds_name, ds_examples, tenant_id)
    session.request = fake_request.request
    client = Client(
        api_url="http://localhost:1984",
        api_key="123",
        session=session,
        info=ls_schemas.LangSmithInfo(
            batch_ingest_config=ls_schemas.BatchIngestConfig(
                size_limit_bytes=None,  # Note this field is not used here
                size_limit=100,
                scale_up_nthreads_limit=16,
                scale_up_qsize_trigger=1000,
                scale_down_nempty_trigger=4,
            )
        ),
    )
    client._tenant_id = tenant_id  # type: ignore

    ordering_of_stuff: List[str] = []
    locked = False

    lock = asyncio.Lock()
    slow_index = None

    async def predict(inputs: dict) -> dict:
        nonlocal locked
        nonlocal slow_index

        if len(ordering_of_stuff) > 2 and not locked:
            async with lock:
                if len(ordering_of_stuff) > 2 and not locked:
                    locked = True
                    await asyncio.sleep(3)
                    slow_index = len(ordering_of_stuff)
                    ordering_of_stuff.append("predict")
                else:
                    ordering_of_stuff.append("predict")

        else:
            ordering_of_stuff.append("predict")
        return {"output": inputs["in"] + 1}

    async def score_value_first(run, example):
        ordering_of_stuff.append("evaluate")
        return {"score": 0.3}

    results = await aevaluate(
        predict,
        client=client,
        data=dev_split,
        evaluators=[score_value_first],
        num_repetitions=NUM_REPETITIONS,
        blocking=blocking,
    )
    if not blocking:
        deltas = []
        last = None
        start = time.time()
        now = None
        async for _ in results:
            now = time.time()
            if last is None:
                elapsed = now - start
                assert elapsed < 3
            deltas.append((now - last) if last is not None else 0)  # type: ignore
            last = now
        total = now - start  # type: ignore
        assert total > 1.5

        # Essentially we want to check that 1 delay is > 1.5s and the rest are < 0.1s
        assert len(deltas) == SPLIT_SIZE * NUM_REPETITIONS

        total_quick = sum([d < 0.5 for d in deltas])
        total_slow = sum([d > 0.5 for d in deltas])
        tolerance = 3
        assert total_slow < tolerance
        assert total_quick > (SPLIT_SIZE * NUM_REPETITIONS - 1) - tolerance
        assert any([d > 1 for d in deltas])
    _all_results = []
    async for r in results:
        assert r["run"].outputs["output"] == r["example"].inputs["in"] + 1  # type: ignore
        assert set(r["run"].outputs.keys()) == {"output"}  # type: ignore
        _all_results.append(r)
        if len(_all_results) == 1:
            # Ensure we aren't resetting some stateful thing on the results obj
            [r async for r in results]
    assert len(_all_results) == SPLIT_SIZE * NUM_REPETITIONS

    assert fake_request.created_session
    _wait_until(lambda: fake_request.runs)
    N_PREDS = SPLIT_SIZE * NUM_REPETITIONS
    _wait_until(lambda: len(ordering_of_stuff) == N_PREDS * 2)
    _wait_until(lambda: slow_index is not None)
    # Want it to be interleaved
    assert ordering_of_stuff != ["predict"] * N_PREDS + ["evaluate"] * N_PREDS
    assert slow_index is not None
    # It's delayed, so it'll be the penultimate event
    # Will run all other preds and evals, then this, then the last eval
    assert slow_index == (N_PREDS * 2) - 2

    assert fake_request.created_session["name"]

    async def score_value(run, example):
        return {"score": 0.7}

    ex_results = await aevaluate_existing(
        fake_request.created_session["name"], evaluators=[score_value], client=client
    )
    all_results = [r async for r in ex_results]
    assert len(all_results) == SPLIT_SIZE * NUM_REPETITIONS
    dev_xample_ids = [e.id for e in dev_split]
    async for r in ex_results:
        assert r["example"].id in dev_xample_ids
        assert r["evaluation_results"]["results"][0].score == 0.7
        assert r["run"].reference_example_id in dev_xample_ids
    assert not fake_request.should_fail
