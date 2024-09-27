"""Test the LangSmith client."""

import asyncio
import dataclasses
import gc
import itertools
import json
import math
import sys
import threading
import time
import uuid
import warnings
import weakref
from datetime import datetime, timezone
from enum import Enum
from io import BytesIO
from typing import Any, NamedTuple, Optional, Type, Union
from unittest import mock
from unittest.mock import MagicMock, patch

import attr
import dataclasses_json
import msgspec
import pytest
import requests
from pydantic import BaseModel
from requests import HTTPError

import langsmith.env as ls_env
import langsmith.utils as ls_utils
from langsmith import AsyncClient, EvaluationResult, run_trees
from langsmith import schemas as ls_schemas
from langsmith.client import (
    Client,
    _dumps_json,
    _is_langchain_hosted,
    _serialize_json,
)

_CREATED_AT = datetime(2015, 1, 1, 0, 0, 0)


def test_is_localhost() -> None:
    assert ls_utils._is_localhost("http://localhost:1984")
    assert ls_utils._is_localhost("http://localhost:1984")
    assert ls_utils._is_localhost("http://0.0.0.0:1984")
    assert not ls_utils._is_localhost("http://example.com:1984")


def test__is_langchain_hosted() -> None:
    assert _is_langchain_hosted("https://api.smith.langchain.com")
    assert _is_langchain_hosted("https://beta.api.smith.langchain.com")
    assert _is_langchain_hosted("https://dev.api.smith.langchain.com")


def _clear_env_cache():
    ls_utils.get_env_var.cache_clear()


def test_validate_api_url(monkeypatch: pytest.MonkeyPatch) -> None:
    # Scenario 1: Both LANGCHAIN_ENDPOINT and LANGSMITH_ENDPOINT
    # are set, but api_url is not
    _clear_env_cache()
    monkeypatch.setenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain-endpoint.com")
    monkeypatch.setenv("LANGSMITH_ENDPOINT", "https://api.smith.langsmith-endpoint.com")

    client = Client()
    assert client.api_url == "https://api.smith.langsmith-endpoint.com"

    # Scenario 2: Both LANGCHAIN_ENDPOINT and LANGSMITH_ENDPOINT
    #  are set, and api_url is set
    _clear_env_cache()
    monkeypatch.setenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain-endpoint.com")
    monkeypatch.setenv("LANGSMITH_ENDPOINT", "https://api.smith.langsmith-endpoint.com")

    client = Client(api_url="https://api.smith.langchain.com", api_key="123")
    assert client.api_url == "https://api.smith.langchain.com"

    # Scenario 3: LANGCHAIN_ENDPOINT is set, but LANGSMITH_ENDPOINT is not
    _clear_env_cache()
    monkeypatch.setenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain-endpoint.com")
    monkeypatch.delenv("LANGSMITH_ENDPOINT", raising=False)

    client = Client()
    assert client.api_url == "https://api.smith.langchain-endpoint.com"

    # Scenario 4: LANGCHAIN_ENDPOINT is not set, but LANGSMITH_ENDPOINT is set
    _clear_env_cache()
    monkeypatch.delenv("LANGCHAIN_ENDPOINT", raising=False)
    monkeypatch.setenv("LANGSMITH_ENDPOINT", "https://api.smith.langsmith-endpoint.com")

    client = Client()
    assert client.api_url == "https://api.smith.langsmith-endpoint.com"


def test_validate_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    # Scenario 1: Both LANGCHAIN_API_KEY and LANGSMITH_API_KEY are set,
    # but api_key is not
    _clear_env_cache()
    monkeypatch.setenv("LANGCHAIN_API_KEY", "env_langchain_api_key")
    monkeypatch.setenv("LANGSMITH_API_KEY", "env_langsmith_api_key")

    client = Client()
    assert client.api_key == "env_langsmith_api_key"

    # Scenario 2: Both LANGCHAIN_API_KEY and LANGSMITH_API_KEY are set,
    # and api_key is set
    _clear_env_cache()
    monkeypatch.setenv("LANGCHAIN_API_KEY", "env_langchain_api_key")
    monkeypatch.setenv("LANGSMITH_API_KEY", "env_langsmith_api_key")

    client = Client(api_url="https://api.smith.langchain.com", api_key="123")
    assert client.api_key == "123"

    # Scenario 3: LANGCHAIN_API_KEY is set, but LANGSMITH_API_KEY is not
    monkeypatch.setenv("LANGCHAIN_API_KEY", "env_langchain_api_key")
    monkeypatch.delenv("LANGSMITH_API_KEY", raising=False)

    client = Client()
    assert client.api_key == "env_langchain_api_key"

    # Scenario 4: LANGCHAIN_API_KEY is not set, but LANGSMITH_API_KEY is set
    _clear_env_cache()
    monkeypatch.delenv("LANGCHAIN_API_KEY", raising=False)
    monkeypatch.setenv("LANGSMITH_API_KEY", "env_langsmith_api_key")

    client = Client()
    assert client.api_key == "env_langsmith_api_key"


def test_validate_multiple_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_env_cache()
    monkeypatch.setenv("LANGCHAIN_ENDPOINT", "https://api.smith.langchain-endpoint.com")
    monkeypatch.setenv("LANGSMITH_ENDPOINT", "https://api.smith.langsmith-endpoint.com")
    monkeypatch.setenv("LANGSMITH_RUNS_ENDPOINTS", "{}")

    with pytest.raises(ls_utils.LangSmithUserError):
        Client()

    monkeypatch.undo()
    with pytest.raises(ls_utils.LangSmithUserError):
        Client(
            api_url="https://api.smith.langchain.com",
            api_key="123",
            api_urls={"https://api.smith.langchain.com": "123"},
        )

    data = {
        "https://api.smith.langsmith-endpoint_1.com": "123",
        "https://api.smith.langsmith-endpoint_2.com": "456",
        "https://api.smith.langsmith-endpoint_3.com": "789",
    }
    monkeypatch.delenv("LANGCHAIN_ENDPOINT", raising=False)
    monkeypatch.delenv("LANGSMITH_ENDPOINT", raising=False)
    monkeypatch.setenv("LANGSMITH_RUNS_ENDPOINTS", json.dumps(data))
    client = Client()
    assert client._write_api_urls == data
    assert client.api_url == "https://api.smith.langsmith-endpoint_1.com"
    assert client.api_key == "123"


def test_headers(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_env_cache()
    monkeypatch.delenv("LANGCHAIN_API_KEY", raising=False)
    with patch.dict("os.environ", {}, clear=True):
        client = Client(api_url="http://localhost:1984", api_key="123")
        assert "x-api-key" in client._headers
        assert client._headers["x-api-key"] == "123"

        client_no_key = Client(api_url="http://localhost:1984")
        assert "x-api-key" not in client_no_key._headers


@mock.patch("langsmith.client.requests.Session")
def test_upload_csv(mock_session_cls: mock.Mock) -> None:
    _clear_env_cache()
    dataset_id = str(uuid.uuid4())
    example_1 = ls_schemas.Example(
        id=str(uuid.uuid4()),
        created_at=_CREATED_AT,
        inputs={"input": "1"},
        outputs={"output": "2"},
        dataset_id=dataset_id,
    )
    example_2 = ls_schemas.Example(
        id=str(uuid.uuid4()),
        created_at=_CREATED_AT,
        inputs={"input": "3"},
        outputs={"output": "4"},
        dataset_id=dataset_id,
    )
    mock_response = mock.Mock()
    mock_response.json.return_value = {
        "id": dataset_id,
        "name": "test.csv",
        "description": "Test dataset",
        "owner_id": "the owner",
        "created_at": _CREATED_AT,
        "examples": [example_1, example_2],
    }
    mock_session = mock.Mock()

    def mock_request(*args, **kwargs):  # type: ignore
        if args[0] == "POST" and args[1].endswith("datasets"):
            return mock_response
        return MagicMock()

    mock_session.request.return_value = mock_response
    mock_session_cls.return_value = mock_session

    client = Client(
        api_url="http://localhost:1984",
        api_key="123",
    )
    client._tenant_id = uuid.uuid4()
    csv_file = ("test.csv", BytesIO(b"input,output\n1,2\n3,4\n"))

    dataset = client.upload_csv(
        csv_file,
        description="Test dataset",
        input_keys=["input"],
        output_keys=["output"],
    )

    assert dataset.id == uuid.UUID(dataset_id)
    assert dataset.name == "test.csv"
    assert dataset.description == "Test dataset"


def test_async_methods() -> None:
    """For every method defined on the Client, if there is a

    corresponding async method, then the async method args should be a
    superset of the sync method args.
    """
    sync_methods = [
        method
        for method in dir(Client)
        if not method.startswith("_")
        and callable(getattr(Client, method))
        and not asyncio.iscoroutinefunction(getattr(Client, method))
    ]
    async_methods = [
        method
        for method in dir(Client)
        if not method.startswith("_")
        and method not in {"arun_on_dataset"}
        and callable(getattr(Client, method))
        and asyncio.iscoroutinefunction(getattr(Client, method))
    ]

    for async_method in async_methods:
        sync_method = async_method[1:]  # Remove the "a" from the beginning
        assert sync_method in sync_methods
        sync_args = set(Client.__dict__[sync_method].__code__.co_varnames)
        async_args = set(Client.__dict__[async_method].__code__.co_varnames)
        extra_args = sync_args - async_args
        assert not extra_args, (
            f"Extra args for {async_method} "
            f"(compared to {sync_method}): {extra_args}"
        )


def test_create_run_unicode() -> None:
    inputs = {
        "foo": "これは私の友達です",
        "bar": "این یک کتاب است",
        "baz": "😊🌺🎉💻🚀🌈🍕🏄‍♂️🎁🐶🌟🏖️👍🚲🎈",
        "qux": "나는\u3000밥을\u3000먹었습니다.",
        "는\u3000밥": "나는\u3000밥을\u3000먹었습니다.",
    }
    session = mock.Mock()
    session.request = mock.Mock()
    client = Client(api_url="http://localhost:1984", api_key="123", session=session)
    id_ = uuid.uuid4()
    client.create_run("my_run", inputs=inputs, run_type="llm", id=id_)
    client.update_run(id_, status="completed")


def test_create_run_mutate() -> None:
    inputs = {"messages": ["hi"], "mygen": (i for i in range(10))}
    session = mock.Mock()
    session.request = mock.Mock()
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
    id_ = uuid.uuid4()
    run_dict = dict(
        id=id_,
        name="my_run",
        inputs=inputs,
        run_type="llm",
        trace_id=id_,
        dotted_order=run_trees._create_current_dotted_order(
            datetime.now(timezone.utc), id_
        ),
    )
    client.create_run(**run_dict)  # type: ignore
    inputs["messages"].append("there")  # type: ignore
    outputs = {"messages": ["hi", "there"]}
    client.update_run(
        id_,
        outputs=outputs,
        end_time=datetime.now(timezone.utc),
        trace_id=id_,
        dotted_order=run_dict["dotted_order"],
    )
    for _ in range(10):
        time.sleep(0.1)  # Give the background thread time to stop
        payloads = [
            json.loads(call[2]["data"])
            for call in session.request.mock_calls
            if call.args and call.args[1].endswith("runs/batch")
        ]
        if payloads:
            break
    posts = [pr for payload in payloads for pr in payload.get("post", [])]
    patches = [pr for payload in payloads for pr in payload.get("patch", [])]
    inputs = next(
        (pr["inputs"] for pr in itertools.chain(posts, patches) if pr.get("inputs")),
        {},
    )
    outputs = next(
        (pr["outputs"] for pr in itertools.chain(posts, patches) if pr.get("outputs")),
        {},
    )
    # Check that the mutated value wasn't posted
    assert "messages" in inputs
    assert inputs["messages"] == ["hi"]
    assert "mygen" in inputs
    assert inputs["mygen"].startswith(  # type: ignore
        "<generator object test_create_run_mutate.<locals>."
    )
    assert outputs == {"messages": ["hi", "there"]}


class CallTracker:
    def __init__(self) -> None:
        self.counter = 0

    def __call__(self, *args: object, **kwargs: object) -> None:
        self.counter += 1


@pytest.mark.flaky(reruns=5)
@pytest.mark.parametrize("supports_batch_endpoint", [True, False])
@pytest.mark.parametrize("auto_batch_tracing", [True, False])
def test_client_gc(auto_batch_tracing: bool, supports_batch_endpoint: bool) -> None:
    session = mock.MagicMock(spec=requests.Session)
    api_url = "http://localhost:1984"

    def mock_get(*args, **kwargs):
        if args[0] == f"{api_url}/info":
            response = mock.Mock()
            if supports_batch_endpoint:
                response.json.return_value = {}
            else:
                response.raise_for_status.side_effect = HTTPError()
                response.status_code = 404
            return response
        else:
            return MagicMock()

    session.get.side_effect = mock_get
    client = Client(
        api_url=api_url,
        api_key="123",
        auto_batch_tracing=auto_batch_tracing,
        session=session,
    )
    tracker = CallTracker()
    weakref.finalize(client, tracker)
    assert tracker.counter == 0

    for _ in range(10):
        id = uuid.uuid4()
        client.create_run(
            "my_run",
            inputs={},
            run_type="llm",
            id=id,
            trace_id=id,
            dotted_order=id,
        )

    if auto_batch_tracing:
        assert client.tracing_queue
        client.tracing_queue.join()

        request_calls = [
            call
            for call in session.request.mock_calls
            if call.args and call.args[0] == "POST"
        ]
        assert len(request_calls) >= 1

        for call in request_calls:
            assert call.args[0] == "POST"
            assert call.args[1] == "http://localhost:1984/runs/batch"
        get_calls = [
            call
            for call in session.request.mock_calls
            if call.args and call.args[0] == "GET"
        ]
        # assert len(get_calls) == 1
        for call in get_calls:
            assert call.args[1] == f"{api_url}/info"
    else:
        request_calls = [
            call
            for call in session.request.mock_calls
            if call.args and call.args[0] == "POST"
        ]

        assert len(request_calls) == 10
        for call in request_calls:
            assert call.args[0] == "POST"
            assert call.args[1] == "http://localhost:1984/runs"
        if auto_batch_tracing:
            get_calls = [
                call
                for call in session.get.mock_calls
                if call.args and call.args[0] == "GET"
            ]
            for call in get_calls:
                assert call.args[1] == f"{api_url}/info"
    del client
    time.sleep(3)  # Give the background thread time to stop
    gc.collect()  # Force garbage collection
    assert tracker.counter == 1, "Client was not garbage collected"


@pytest.mark.parametrize("auto_batch_tracing", [True, False])
def test_client_gc_no_batched_runs(auto_batch_tracing: bool) -> None:
    session = mock.MagicMock(spec=requests.Session)
    client = Client(
        api_url="http://localhost:1984",
        api_key="123",
        auto_batch_tracing=auto_batch_tracing,
        session=session,
    )
    tracker = CallTracker()
    weakref.finalize(client, tracker)
    assert tracker.counter == 0

    # because no trace_id/dotted_order provided, auto batch is disabled
    for _ in range(10):
        client.create_run("my_run", inputs={}, run_type="llm", id=uuid.uuid4())
    request_calls = [
        call
        for call in session.request.mock_calls
        if call.args and call.args[0] == "POST"
    ]
    assert len(request_calls) == 10
    for call in request_calls:
        assert call.args[1] == "http://localhost:1984/runs"

    del client
    time.sleep(2)  # Give the background thread time to stop
    gc.collect()  # Force garbage collection
    assert tracker.counter == 1, "Client was not garbage collected"


@pytest.mark.parametrize("auto_batch_tracing", [True, False])
def test_create_run_with_filters(auto_batch_tracing: bool) -> None:
    session = mock.MagicMock(spec=requests.Session)

    def filter_inputs(inputs: dict) -> dict:
        return {"hi there": "woah"}

    def filter_outputs(outputs: dict):
        return {k: v + "goodbye" for k, v in outputs.items()}

    client = Client(
        api_url="http://localhost:1984",
        api_key="123",
        auto_batch_tracing=auto_batch_tracing,
        session=session,
        hide_inputs=filter_inputs,
        hide_outputs=filter_outputs,
    )
    tracker = CallTracker()
    weakref.finalize(client, tracker)
    assert tracker.counter == 0
    expected = ['"hi there":"woah"']
    for _ in range(3):
        id_ = uuid.uuid4()
        client.create_run("my_run", inputs={"foo": "bar"}, run_type="llm", id=id_)
        output_val = uuid.uuid4().hex[:5]
        client.update_run(
            id_, end_time=datetime.now(), outputs={"theoutput": output_val}
        )
        expected.append(output_val + "goodbye")

    request_calls = [
        call
        for call in session.request.mock_calls
        if call.args and call.args[0] in {"POST", "PATCH"}
    ]
    all_posted = "\n".join(
        [call.kwargs["data"].decode("utf-8") for call in request_calls]
    )
    assert all([exp in all_posted for exp in expected])


def test_client_gc_after_autoscale() -> None:
    session = mock.MagicMock(spec=requests.Session)
    client = Client(
        api_url="http://localhost:1984",
        api_key="123",
        session=session,
        auto_batch_tracing=True,
    )
    tracker = CallTracker()
    weakref.finalize(client, tracker)
    assert tracker.counter == 0

    tracing_queue = client.tracing_queue
    assert tracing_queue is not None

    for _ in range(50_000):
        id = uuid.uuid4()
        client.create_run(
            "my_run",
            inputs={},
            run_type="llm",
            id=id,
            trace_id=id,
            dotted_order=id,
        )

    del client
    tracing_queue.join()
    time.sleep(2)  # Give the background threads time to stop
    gc.collect()  # Force garbage collection
    assert tracker.counter == 1, "Client was not garbage collected"

    request_calls = [
        call
        for call in session.request.mock_calls
        if call.args and call.args[0] == "POST"
    ]
    assert len(request_calls) >= 500 and len(request_calls) <= 550
    for call in request_calls:
        assert call.args[0] == "POST"
        assert call.args[1] == "http://localhost:1984/runs/batch"


@pytest.mark.parametrize("supports_batch_endpoint", [True, False])
@pytest.mark.parametrize("auto_batch_tracing", [True, False])
def test_create_run_includes_langchain_env_var_metadata(
    supports_batch_endpoint: bool,
    auto_batch_tracing: bool,
) -> None:
    session = mock.Mock()
    session.request = mock.Mock()
    api_url = "http://localhost:1984"

    def mock_get(*args, **kwargs):
        if args[0] == f"{api_url}/info":
            response = mock.Mock()
            if supports_batch_endpoint:
                response.json.return_value = {}
            else:
                response.raise_for_status.side_effect = HTTPError()
                response.status_code = 404
            return response
        else:
            return MagicMock()

    session.get.side_effect = mock_get
    client = Client(
        api_url=api_url,
        api_key="123",
        auto_batch_tracing=auto_batch_tracing,
        session=session,
    )
    inputs = {
        "foo": "これは私の友達です",
        "bar": "این یک کتاب است",
        "baz": "😊🌺🎉💻🚀🌈🍕🏄‍♂️🎁🐶🌟🏖️👍🚲🎈",
        "qux": "나는\u3000밥을\u3000먹었습니다.",
        "는\u3000밥": "나는\u3000밥을\u3000먹었습니다.",
    }

    # Set the environment variables just for this test
    with patch.dict("os.environ", {"LANGCHAIN_REVISION": "abcd2234"}):
        # Clear the cache to ensure the environment variables are re-read
        ls_env.get_langchain_env_var_metadata.cache_clear()
        id_ = uuid.uuid4()
        start_time = datetime.now()
        client.create_run(
            "my_run",
            inputs=inputs,
            run_type="llm",
            id=id_,
            trace_id=id_,
            dotted_order=f"{start_time.strftime('%Y%m%dT%H%M%S%fZ')}{id_}",
            start_time=start_time,
        )
        if tracing_queue := client.tracing_queue:
            tracing_queue.join()
        # Check the posted value in the request
        posted_value = json.loads(session.request.call_args[1]["data"])
        if auto_batch_tracing:
            assert (
                posted_value["post"][0]["extra"]["metadata"]["LANGCHAIN_REVISION"]
                == "abcd2234"
            )
        else:
            assert posted_value["extra"]["metadata"]["LANGCHAIN_REVISION"] == "abcd2234"
            assert "LANGCHAIN_API_KEY" not in posted_value["extra"]["metadata"]


@pytest.mark.parametrize("source_type", ["api", "model"])
def test_create_feedback_string_source_type(source_type: str) -> None:
    session = mock.Mock()
    client = Client(api_url="http://localhost:1984", api_key="123", session=session)
    request_object = mock.Mock()
    request_object.json.return_value = {
        "id": uuid.uuid4(),
        "key": "Foo",
        "created_at": _CREATED_AT,
        "modified_at": _CREATED_AT,
        "run_id": uuid.uuid4(),
    }
    session.post.return_value = request_object
    id_ = uuid.uuid4()
    client.create_feedback(
        id_,
        key="Foo",
        feedback_source_type=source_type,
    )


def test_pydantic_serialize() -> None:
    """Test that pydantic objects can be serialized."""
    test_uuid = uuid.uuid4()
    test_time = datetime.now()

    class ChildPydantic(BaseModel):
        uid: uuid.UUID

    class MyPydantic(BaseModel):
        foo: str
        uid: uuid.UUID
        tim: datetime
        ex: Optional[str] = None
        child: Optional[ChildPydantic] = None

    obj = MyPydantic(
        foo="bar", uid=test_uuid, tim=test_time, child=ChildPydantic(uid=test_uuid)
    )
    res = json.loads(json.dumps(obj, default=_serialize_json))
    expected = {
        "foo": "bar",
        "uid": str(test_uuid),
        "tim": test_time.isoformat(),
        "child": {
            "uid": str(test_uuid),
        },
    }
    assert res == expected

    obj2 = {"output": obj}
    res2 = json.loads(json.dumps(obj2, default=_serialize_json))
    assert res2 == {"output": expected}


def test_serialize_json() -> None:
    class MyClass:
        def __init__(self, x: int) -> None:
            self.x = x
            self.y = "y"
            self.a_list = [1, 2, 3]
            self.a_tuple = (1, 2, 3)
            self.a_set = {1, 2, 3}
            self.a_dict = {"foo": "bar"}
            self.my_bytes = b"foo"

    class ClassWithTee:
        def __init__(self) -> None:
            tee_a, tee_b = itertools.tee(range(10))
            self.tee_a = tee_a
            self.tee_b = tee_b

    class MyClassWithSlots:
        __slots__ = ["x", "y"]

        def __init__(self, x: int) -> None:
            self.x = x
            self.y = "y"

    class MyPydantic(BaseModel):
        foo: str
        bar: int

    @dataclasses.dataclass
    class MyDataclass:
        foo: str
        bar: int

        def something(self) -> None:
            pass

    class MyEnum(str, Enum):
        FOO = "foo"
        BAR = "bar"

    class ClassWithFakeJson:
        def json(self):
            raise ValueError("This should not be called")

        def to_json(self) -> dict:
            return {"foo": "bar"}

    @dataclasses_json.dataclass_json
    @dataclasses.dataclass
    class Person:
        name: str

    @attr.dataclass
    class AttrDict:
        foo: str = attr.ib()
        bar: int

    uid = uuid.uuid4()
    current_time = datetime.now()

    class NestedClass:
        __slots__ = ["person", "lock"]

        def __init__(self) -> None:
            self.person = Person(name="foo")
            self.lock = [threading.Lock()]

    class CyclicClass:
        def __init__(self) -> None:
            self.cyclic = self

        def __repr__(self) -> str:
            return "SoCyclic"

    class CyclicClass2:
        def __init__(self) -> None:
            self.cyclic: Any = None
            self.other: Any = None

        def __repr__(self) -> str:
            return "SoCyclic2"

    cycle_2 = CyclicClass2()
    cycle_2.cyclic = CyclicClass2()
    cycle_2.cyclic.other = cycle_2

    class MyNamedTuple(NamedTuple):
        foo: str
        bar: int

    to_serialize = {
        "uid": uid,
        "time": current_time,
        "my_class": MyClass(1),
        "class_with_tee": ClassWithTee(),
        "my_slotted_class": MyClassWithSlots(1),
        "my_dataclass": MyDataclass("foo", 1),
        "my_enum": MyEnum.FOO,
        "my_pydantic": MyPydantic(foo="foo", bar=1),
        "person": Person(name="foo"),
        "a_bool": True,
        "a_none": None,
        "a_str": "foo",
        "an_int": 1,
        "a_float": 1.1,
        "nested_class": NestedClass(),
        "attr_dict": AttrDict(foo="foo", bar=1),
        "named_tuple": MyNamedTuple(foo="foo", bar=1),
        "cyclic": CyclicClass(),
        "cyclic2": cycle_2,
        "fake_json": ClassWithFakeJson(),
    }
    res = msgspec.json.decode(_dumps_json(to_serialize))
    expected = {
        "uid": str(uid),
        "time": current_time.isoformat(),
        "my_class": {
            "x": 1,
            "y": "y",
            "a_list": [1, 2, 3],
            "a_tuple": [1, 2, 3],
            "a_set": [1, 2, 3],
            "a_dict": {"foo": "bar"},
            "my_bytes": "foo",
        },
        "class_with_tee": lambda val: all(
            ["_tee object" in val[key] for key in ["tee_a", "tee_b"]]
        ),
        "my_slotted_class": {"x": 1, "y": "y"},
        "my_dataclass": {"foo": "foo", "bar": 1},
        "my_enum": "foo",
        "my_pydantic": {"foo": "foo", "bar": 1},
        "person": {"name": "foo"},
        "a_bool": True,
        "a_none": None,
        "a_str": "foo",
        "an_int": 1,
        "a_float": 1.1,
        "nested_class": (
            lambda val: val["person"] == {"name": "foo"}
            and "_thread.lock object" in str(val.get("lock"))
        ),
        "attr_dict": {"foo": "foo", "bar": 1},
        "named_tuple": ["foo", 1],
        "cyclic": {"cyclic": "SoCyclic"},
        # We don't really care about this case just want to not err
        "cyclic2": lambda _: True,
        "fake_json": {"foo": "bar"},
    }
    assert set(expected) == set(res)
    for k, v in expected.items():
        try:
            if callable(v):
                assert v(res[k]), f"Failed for {k}"
            else:
                assert res[k] == v, f"Failed for {k}"
        except AssertionError:
            raise


def test__dumps_json():
    chars = "".join(chr(cp) for cp in range(0, sys.maxunicode + 1))
    trans_table = str.maketrans("", "", "")
    all_chars = chars.translate(trans_table)
    serialized_json = _dumps_json({"chars": all_chars})
    assert isinstance(serialized_json, bytes)
    serialized_str = serialized_json.decode("utf-8")
    assert '"chars"' in serialized_str
    assert "\\uD800" not in serialized_str
    assert "\\uDC00" not in serialized_str


@patch("langsmith.client.requests.Session", autospec=True)
def test_host_url(_: MagicMock) -> None:
    client = Client(api_url="https://api.foobar.com/api", api_key="API_KEY")
    assert client._host_url == "https://api.foobar.com"

    client = Client(
        api_url="https://api.langsmith.com",
        api_key="API_KEY",
        web_url="https://web.langsmith.com",
    )
    assert client._host_url == "https://web.langsmith.com"

    client = Client(api_url="http://localhost:8000", api_key="API_KEY")
    assert client._host_url == "http://localhost"

    client = Client(api_url="https://eu.api.smith.langchain.com", api_key="API_KEY")
    assert client._host_url == "https://eu.smith.langchain.com"

    client = Client(api_url="https://dev.api.smith.langchain.com", api_key="API_KEY")
    assert client._host_url == "https://dev.smith.langchain.com"

    client = Client(api_url="https://api.smith.langchain.com", api_key="API_KEY")
    assert client._host_url == "https://smith.langchain.com"


@patch("langsmith.client.time.sleep")
def test_retry_on_connection_error(mock_sleep: MagicMock):
    mock_session = MagicMock()
    client = Client(api_key="test", session=mock_session, auto_batch_tracing=False)
    mock_session.request.side_effect = requests.ConnectionError()

    with pytest.raises(ls_utils.LangSmithConnectionError):
        client.request_with_retries("GET", "https://test.url", stop_after_attempt=2)
    assert mock_session.request.call_count == 2


@patch("langsmith.client.time.sleep")
def test_http_status_500_handling(mock_sleep):
    mock_session = MagicMock()
    client = Client(api_key="test", session=mock_session, auto_batch_tracing=False)
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.raise_for_status.side_effect = HTTPError()
    mock_session.request.return_value = mock_response

    with pytest.raises(ls_utils.LangSmithAPIError):
        client.request_with_retries("GET", "https://test.url", stop_after_attempt=2)
    assert mock_session.request.call_count == 2


@patch("langsmith.client.time.sleep")
def test_pass_on_409_handling(mock_sleep):
    mock_session = MagicMock()
    client = Client(api_key="test", session=mock_session, auto_batch_tracing=False)
    mock_response = MagicMock()
    mock_response.status_code = 409
    mock_response.raise_for_status.side_effect = HTTPError()
    mock_session.request.return_value = mock_response
    response = client.request_with_retries(
        "GET",
        "https://test.url",
        stop_after_attempt=5,
        to_ignore=[ls_utils.LangSmithConflictError],
    )
    assert mock_session.request.call_count == 1
    assert response == mock_response


@patch("langsmith.client.ls_utils.raise_for_status_with_text")
def test_http_status_429_handling(mock_raise_for_status):
    mock_session = MagicMock()
    client = Client(api_key="test", session=mock_session)
    mock_response = MagicMock()
    mock_response.status_code = 429
    mock_session.request.return_value = mock_response
    mock_raise_for_status.side_effect = HTTPError()
    with pytest.raises(ls_utils.LangSmithRateLimitError):
        client.request_with_retries("GET", "https://test.url")


@patch("langsmith.client.ls_utils.raise_for_status_with_text")
def test_http_status_401_handling(mock_raise_for_status):
    mock_session = MagicMock()
    client = Client(api_key="test", session=mock_session)
    mock_response = MagicMock()
    mock_response.status_code = 401
    mock_session.request.return_value = mock_response
    mock_raise_for_status.side_effect = HTTPError()
    with pytest.raises(ls_utils.LangSmithAuthError):
        client.request_with_retries("GET", "https://test.url")


@patch("langsmith.client.ls_utils.raise_for_status_with_text")
def test_http_status_404_handling(mock_raise_for_status):
    mock_session = MagicMock()
    client = Client(api_key="test", session=mock_session)
    mock_response = MagicMock()
    mock_response.status_code = 404
    mock_session.request.return_value = mock_response
    mock_raise_for_status.side_effect = HTTPError()
    with pytest.raises(ls_utils.LangSmithNotFoundError):
        client.request_with_retries("GET", "https://test.url")


@patch("langsmith.client.ls_utils.raise_for_status_with_text")
def test_batch_ingest_run_retry_on_429(mock_raise_for_status):
    mock_session = MagicMock()
    client = Client(api_key="test", session=mock_session)
    mock_response = MagicMock()
    mock_response.headers = {"retry-after": "0.5"}
    mock_response.status_code = 429
    mock_session.request.return_value = mock_response
    mock_raise_for_status.side_effect = HTTPError()

    client.batch_ingest_runs(
        create=[
            {
                "name": "test",
                "id": str(uuid.uuid4()),
                "trace_id": str(uuid.uuid4()),
                "dotted_order": str(uuid.uuid4()),
            }
        ],
    )
    # Check that there were 3 post calls (may be other get calls though)
    assert mock_session.request.call_count >= 3
    # count the number of POST requests
    assert (
        sum([1 for call in mock_session.request.call_args_list if call[0][0] == "POST"])
        == 3
    )


MB = 1024 * 1024


@pytest.mark.parametrize("payload_size", [MB, 5 * MB, 9 * MB, 21 * MB])
def test_batch_ingest_run_splits_large_batches(payload_size: int):
    mock_session = MagicMock()
    client = Client(api_key="test", session=mock_session)
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_session.request.return_value = mock_response
    # Create 6 run ops total, each with an inputs dictionary that's payload_size bytess
    run_ids = [str(uuid.uuid4()) for _ in range(3)]
    patch_ids = [str(uuid.uuid4()) for _ in range(3)]
    posts = [
        {
            "name": "test",
            "id": run_id,
            "trace_id": run_id,
            "dotted_order": run_id,
            "inputs": {"x": "a" * payload_size},
            "start_time": "2021-01-01T00:00:00Z",
        }
        for run_id in run_ids
    ]
    patches = [
        {
            "id": run_id,
            "trace_id": run_id,
            "dotted_order": run_id,
            "end_time": "2021-01-01T00:00:00Z",
            "outputs": {"y": "b" * payload_size},
        }
        for run_id in patch_ids
    ]
    client.batch_ingest_runs(create=posts, update=patches)
    # we can support up to 20MB per batch, so we need to find the number of batches
    # we should be sending
    max_in_batch = max(1, (20 * MB) // (payload_size + 20))

    expected_num_requests = min(6, math.ceil((len(run_ids) * 2) / max_in_batch))
    # count the number of POST requests
    assert (
        sum([1 for call in mock_session.request.call_args_list if call[0][0] == "POST"])
        == expected_num_requests
    )
    request_bodies = [
        op
        for call in mock_session.request.call_args_list
        for reqs in (
            msgspec.json.decode(call[1]["data"]).values()
            if call[0][0] == "POST"
            else []
        )
        for op in reqs
    ]
    all_run_ids = run_ids + patch_ids

    # Check that all the run_ids are present in the request bodies
    for run_id in all_run_ids:
        assert any([body["id"] == str(run_id) for body in request_bodies])

    # Check that no duplicate run_ids are present in the request bodies
    assert len(request_bodies) == len(set([body["id"] for body in request_bodies]))


def test_select_eval_results():
    expected = EvaluationResult(
        key="foo",
        value="bar",
        score=7899082,
        metadata={"a": "b"},
        comment="hi",
        feedback_config={"c": "d"},
    )
    client = Client(api_key="test")
    for count, input_ in [
        (1, expected),
        (1, expected.dict()),
        (1, {"results": [expected]}),
        (1, {"results": [expected.dict()]}),
        (2, {"results": [expected.dict(), expected.dict()]}),
        (2, {"results": [expected, expected]}),
    ]:
        op = client._select_eval_results(input_)
        assert len(op) == count
        assert op == [expected] * count

    expected2 = EvaluationResult(
        key="foo",
        metadata={"a": "b"},
        comment="this is a comment",
        feedback_config={"c": "d"},
    )

    as_reasoning = {
        "reasoning": expected2.comment,
        **expected2.dict(exclude={"comment"}),
    }
    for input_ in [as_reasoning, {"results": [as_reasoning]}, {"results": [expected2]}]:
        assert client._select_eval_results(input_) == [
            expected2,
        ]


@pytest.mark.parametrize("client_cls", [Client, AsyncClient])
def test_validate_api_key_if_hosted(
    monkeypatch: pytest.MonkeyPatch, client_cls: Union[Type[Client], Type[AsyncClient]]
) -> None:
    monkeypatch.delenv("LANGCHAIN_API_KEY", raising=False)
    monkeypatch.delenv("LANGSMITH_API_KEY", raising=False)
    with pytest.warns(ls_utils.LangSmithMissingAPIKeyWarning):
        client_cls(api_url="https://api.smith.langchain.com")
    with warnings.catch_warnings():
        # Check no warning is raised here.
        warnings.simplefilter("error")
        client_cls(api_url="http://localhost:1984")
