import asyncio
import functools
import inspect
import json
import os
import sys
import time
import uuid
import warnings
from typing import Any, AsyncGenerator, Generator, List, Optional, Set, Tuple, cast
from unittest.mock import MagicMock, patch

import pytest

import langsmith
from langsmith import Client
from langsmith import schemas as ls_schemas
from langsmith import utils as ls_utils
from langsmith._internal import _aiter as aitertools
from langsmith.run_helpers import (
    _get_inputs,
    as_runnable,
    get_current_run_tree,
    is_traceable_function,
    trace,
    traceable,
    tracing_context,
)
from langsmith.run_trees import RunTree, get_cached_client


def _get_calls(
    mock_client: Any,
    minimum: Optional[int] = 0,
    verbs: Set[str] = {"POST"},
    attempts: int = 10,
) -> list:
    calls = []
    for _ in range(attempts):
        calls = [
            c
            for c in mock_client.session.request.mock_calls  # type: ignore
            if c.args and c.args[0] in verbs
        ]
        if minimum is None:
            return calls
        if minimum is not None and len(calls) > minimum:
            break
        time.sleep(0.1)
    return calls


def _get_datas(mock_calls: List[Any]) -> List[Tuple[str, dict]]:
    datas = []
    for call_ in mock_calls:
        data = json.loads(call_.kwargs["data"])
        for verb in ("post", "patch"):
            for payload in data.get(verb) or []:
                datas.append((verb, payload))

    return datas


def test__get_inputs_with_no_args() -> None:
    def foo() -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature)
    assert inputs == {}


def test__get_inputs_with_args() -> None:
    def foo(a: int, b: int, c: int) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1, 2, 3)
    assert inputs == {"a": 1, "b": 2, "c": 3}


def test__get_inputs_with_defaults() -> None:
    def foo(a: int, b: int, c: int = 3) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1, 2)
    assert inputs == {"a": 1, "b": 2, "c": 3}


def test__get_inputs_with_var_args() -> None:
    # Mis-named args as kwargs to check that it's mapped correctly
    def foo(a: int, b: int, *kwargs: Any) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1, 2, 3, 4)
    assert inputs == {"a": 1, "b": 2, "kwargs": (3, 4)}


def test__get_inputs_with_var_kwargs() -> None:
    def foo(a: int, b: int, **kwargs: Any) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1, 2, c=3, d=4)
    assert inputs == {"a": 1, "b": 2, "c": 3, "d": 4}


def test__get_inputs_with_var_kwargs_and_varargs() -> None:
    def foo(a: int, b: int, *args: Any, **kwargs: Any) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1, 2, 3, 4, c=5, d=6)
    assert inputs == {"a": 1, "b": 2, "args": (3, 4), "c": 5, "d": 6}


def test__get_inputs_with_class_method() -> None:
    class Foo:
        @classmethod
        def bar(cls, a: int, b: int) -> None:
            pass

    signature = inspect.signature(Foo.bar)
    inputs = _get_inputs(signature, 1, 2)
    assert inputs == {"a": 1, "b": 2}


def test__get_inputs_with_static_method() -> None:
    class Foo:
        @staticmethod
        def bar(a: int, b: int) -> None:
            pass

    signature = inspect.signature(Foo.bar)
    inputs = _get_inputs(signature, 1, 2)
    assert inputs == {"a": 1, "b": 2}


def test__get_inputs_with_self() -> None:
    class Foo:
        def bar(self, a: int, b: int) -> None:
            pass

    signature = inspect.signature(Foo.bar)
    inputs = _get_inputs(signature, Foo(), 1, 2)
    assert inputs == {"a": 1, "b": 2}


def test__get_inputs_with_kwargs_and_var_kwargs() -> None:
    def foo(a: int, b: int, **kwargs: Any) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1, 2, c=3, **{"d": 4})
    assert inputs == {"a": 1, "b": 2, "c": 3, "d": 4}


def test__get_inputs_with_var_kwargs_and_other_kwargs() -> None:
    def foo(a: int, b: int, **kwargs: Any) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1, 2, c=3, other_kwargs={"d": 4})
    assert inputs == {"a": 1, "b": 2, "c": 3, "other_kwargs": {"d": 4}}


def test__get_inputs_with_keyword_only_args() -> None:
    def foo(a: int, *, b: int, c: int) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1, b=2, c=3)
    assert inputs == {"a": 1, "b": 2, "c": 3}


def test__get_inputs_with_keyword_only_args_and_defaults() -> None:
    def foo(a: int, *, b: int = 2, c: int = 3) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1)
    assert inputs == {"a": 1, "b": 2, "c": 3}


def test__get_inputs_misnamed_and_required_keyword_only_args() -> None:
    def foo(kwargs: int, *, b: int, c: int, **some_other_kwargs: Any) -> None:
        pass

    signature = inspect.signature(foo)
    inputs = _get_inputs(signature, 1, b=2, c=3, d=4, e=5, other_kwargs={"f": 6})
    assert inputs == {
        "kwargs": 1,
        "b": 2,
        "c": 3,
        "d": 4,
        "e": 5,
        "other_kwargs": {"f": 6},
    }


def _get_mock_client(**kwargs: Any) -> Client:
    mock_session = MagicMock()
    client = Client(session=mock_session, api_key="test", **kwargs)
    return client


@pytest.fixture
def mock_client() -> Client:
    return _get_mock_client()


@pytest.mark.parametrize("use_next", [True, False])
@pytest.mark.parametrize("return_val", [None, "foo"])
def test_traceable_iterator(
    use_next: bool, return_val: Optional[str], mock_client: Client
) -> None:
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        def my_iterator_fn(a, b, d, **kwargs) -> Any:
            assert kwargs == {"e": 5}
            for i in range(a + b + d):
                yield i
            return return_val

        expected = [0, 1, 2, 3, 4, 5]
        if return_val is not None:
            expected.append(return_val)
        genout = my_iterator_fn(1, 2, 3, e=5)
        if use_next:
            results = []
            while True:
                try:
                    results.append(next(genout))
                except StopIteration as e:
                    assert e.value == return_val
                    if e.value is not None:
                        results.append(e.value)
                    break
        else:
            results = list(genout)
            if return_val is not None:
                results.append(return_val)
        assert results == expected
    # check the mock_calls
    mock_calls = _get_calls(mock_client, minimum=1)
    assert 1 <= len(mock_calls) <= 2

    call = mock_calls[0]
    assert call.args[0] == "POST"
    assert call.args[1].startswith("https://api.smith.langchain.com")
    body = json.loads(mock_calls[0].kwargs["data"])
    assert body["post"]
    assert body["post"][0]["outputs"]["output"] == expected


class MyStreamObject:
    def __init__(self, some_values: list):
        self.vals = some_values
        self._iter = iter(self.vals)

    def __next__(self):
        return next(self._iter)

    def __iter__(self):
        yield from self.vals


class MyAsyncStreamObject:
    def __init__(self, some_values: list):
        self.vals = some_values

        async def iter():
            for val in some_values:
                yield val

        self._iter = iter()

    async def __anext__(self):
        return await aitertools.py_anext(self._iter)

    async def __aiter__(self):
        async for val in self._iter:
            yield val


@pytest.mark.parametrize("use_next", [True, False])
@pytest.mark.parametrize("response_type", ["async", "async"])
async def test_traceable_stream(
    use_next: bool, response_type: str, mock_client: Client
) -> None:
    def reduce_fn(results: list):
        return {"my_output": results}

    @traceable(client=mock_client, reduce_fn=reduce_fn)
    def my_stream_fn(a, b, d, **kwargs):
        assert kwargs == {"e": 5}
        vals = [0, 1, 2, 3, 4, 5]
        if response_type == "sync":
            return MyStreamObject(vals)
        else:
            return MyAsyncStreamObject(vals)

    with tracing_context(enabled=True):
        expected = [0, 1, 2, 3, 4, 5]
        genout = my_stream_fn(1, 2, 3, e=5)
        # assert getattr(genout, "vals") == expected
        if use_next:
            results = []
            if response_type == "sync":
                while True:
                    try:
                        results.append(next(genout))
                    except StopIteration:
                        break
            else:
                while True:
                    try:
                        results.append(await aitertools.py_anext(genout))
                    except StopAsyncIteration:
                        break

        else:
            if response_type == "sync":
                results = list(genout)
            else:
                results = [r async for r in genout]
        assert results == expected
    # check the mock_calls
    mock_calls = _get_calls(mock_client, minimum=1)
    assert 1 <= len(mock_calls) <= 2

    call = mock_calls[0]
    assert call.args[0] == "POST"
    assert call.args[1].startswith("https://api.smith.langchain.com")
    call_data = [json.loads(mock_call.kwargs["data"]) for mock_call in mock_calls]
    body = call_data[0]
    assert body["post"]
    assert body["post"][0]["name"] == "my_stream_fn"
    if body["post"][0]["outputs"]:
        assert body["post"][0]["outputs"] == {"my_output": expected}
    else:
        first_patch = next((d for d in call_data if d.get("patch")), None)
        attempt = 0
        while first_patch is None:
            time.sleep(0.2)
            if attempt > 2:
                assert False, "Could not get patch"
            mock_calls = _get_calls(mock_client, minimum=1)
            call_data = [
                json.loads(mock_call.kwargs["data"]) for mock_call in mock_calls
            ]
            first_patch = next((d for d in call_data if d.get("patch")), None)
            attempt += 1

        assert first_patch["name"] == "my_stream_fn"
        assert first_patch[0]["outputs"] == {"my_output": expected}


@pytest.mark.parametrize("use_next", [True, False])
async def test_traceable_async_iterator(use_next: bool, mock_client: Client) -> None:
    with tracing_context(enabled=True):

        def filter_inputs(kwargs: dict):
            return {"a": "FOOOOOO", "b": kwargs["b"], "d": kwargs["d"]}

        @traceable(client=mock_client, process_inputs=filter_inputs)
        async def my_iterator_fn(a, b, d, **kwargs):
            assert kwargs == {"e": 5}
            for i in range(a + b + d):
                yield i

        expected = [0, 1, 2, 3, 4, 5]
        genout = my_iterator_fn(1, 2, 3, e=5)
        if use_next:
            results = []
            async for item in genout:
                results.append(item)
        else:
            results = [item async for item in genout]
        assert results == expected
        # check the mock_calls
        mock_calls = _get_calls(mock_client, minimum=1)
        assert 1 <= len(mock_calls) <= 2

        call = mock_calls[0]
        assert call.args[0] == "POST"
        assert call.args[1].startswith("https://api.smith.langchain.com")
        body = json.loads(call.kwargs["data"])
        assert body["post"]
        assert body["post"][0]["inputs"] == {"a": "FOOOOOO", "b": 2, "d": 3}
        outputs_ = body["post"][0]["outputs"]
        if "output" in outputs_:
            assert outputs_["output"] == expected
            # Assert the inputs are filtered as expected
        else:
            # It was put in the second batch
            assert len(mock_calls) == 2
            body_2 = json.loads(mock_calls[1].kwargs["data"])
            assert body_2["patch"]
            assert body_2["patch"][0]["outputs"]["output"] == expected


@patch("langsmith.run_trees.Client", autospec=True)
def test_traceable_iterator_noargs(_: MagicMock) -> None:
    @traceable
    def my_iterator_fn(a, b, d):
        for i in range(a + b + d):
            yield i

    assert list(my_iterator_fn(1, 2, 3)) == [0, 1, 2, 3, 4, 5]


@patch("langsmith.run_trees.Client", autospec=True)
async def test_traceable_async_iterator_noargs(_: MagicMock) -> None:
    # Check that it's callable without the parens
    @traceable
    async def my_iterator_fn(a, b, d):
        for i in range(a + b + d):
            yield i

    assert [i async for i in my_iterator_fn(1, 2, 3)] == [0, 1, 2, 3, 4, 5]


@patch("langsmith.client.requests.Session", autospec=True)
def test_as_runnable(_: MagicMock, mock_client: Client) -> None:
    @traceable(client=mock_client)
    def my_function(a, b, d):
        return a + b + d

    with tracing_context(enabled=False):
        runnable = as_runnable(my_function)
        assert runnable.invoke({"a": 1, "b": 2, "d": 3}) == 6


@patch("langsmith.client.requests.Session", autospec=True)
def test_as_runnable_batch(mock_client: Client) -> None:
    @traceable(client=mock_client)
    def my_function(a, b, d):
        return a + b + d

    with tracing_context(enabled=False):
        runnable = as_runnable(my_function)
        assert runnable.batch(
            [
                {"a": 1, "b": 2, "d": 3},
                {"a": 1, "b": 2, "d": 4},
            ]
        ) == [6, 7]


@patch("langsmith.client.requests.Session", autospec=True)
async def test_as_runnable_async(_: MagicMock) -> None:
    @traceable()
    async def my_function(a, b, d):
        return a + b + d

    runnable = as_runnable(my_function)
    with tracing_context(enabled=False):
        result = await runnable.ainvoke({"a": 1, "b": 2, "d": 3})
        assert result == 6


@patch("langsmith.client.requests.Session", autospec=True)
async def test_as_runnable_async_batch(_: MagicMock) -> None:
    @traceable()
    async def my_function(a, b, d):
        return a + b + d

    runnable = as_runnable(my_function)
    with tracing_context(enabled=False):
        result = await runnable.abatch(
            [
                {"a": 1, "b": 2, "d": 3},
                {"a": 1, "b": 2, "d": 4},
            ]
        )
        assert result == [6, 7]


def test_traceable_parent_from_runnable_config() -> None:
    try:
        from langchain.callbacks.tracers import LangChainTracer
        from langchain.schema.runnable import RunnableLambda
    except ImportError:
        pytest.skip("Skipping test that requires langchain")
    with tracing_context(enabled=True):
        mock_client_ = _get_mock_client()

        @traceable()
        def my_function(a: int) -> int:
            return a * 2

        my_function_runnable = RunnableLambda(my_function)

        assert (
            my_function_runnable.invoke(
                1, {"callbacks": [LangChainTracer(client=mock_client_)]}
            )
            == 2
        )
        # Inspect the mock_calls and assert that 2 runs were created,
        # one for the parent and one for the child
        mock_calls = _get_calls(mock_client_, minimum=2)
        posts = []
        for call in mock_calls:
            if call.args and call.args[0] != "GET":
                assert call.args[0] == "POST"
                assert call.args[1].startswith("https://api.smith.langchain.com")
                body = json.loads(call.kwargs["data"])
                assert body["post"]
                posts.extend(body["post"])
        assert len(posts) == 2
        parent = next(p for p in posts if p["parent_run_id"] is None)
        child = next(p for p in posts if p["parent_run_id"] is not None)
        assert child["parent_run_id"] == parent["id"]


def test_traceable_parent_from_runnable_config_accepts_config() -> None:
    try:
        from langchain.callbacks.tracers import LangChainTracer
        from langchain.schema.runnable import RunnableLambda
    except ImportError:
        pytest.skip("Skipping test that requires langchain")
    with tracing_context(enabled=True):
        mock_client_ = _get_mock_client()

        @traceable()
        def my_function(a: int, config: dict) -> int:
            assert isinstance(config, dict)
            return a * 2

        my_function_runnable = RunnableLambda(my_function)

        assert (
            my_function_runnable.invoke(
                1, {"callbacks": [LangChainTracer(client=mock_client_)]}
            )
            == 2
        )
        # Inspect the mock_calls and assert that 2 runs were created,
        # one for the parent and one for the child
        mock_calls = _get_calls(mock_client_, minimum=2)
        posts = []
        for call in mock_calls:
            if call.args and call.args[0] != "GET":
                assert call.args[0] == "POST"
                assert call.args[1].startswith("https://api.smith.langchain.com")
                body = json.loads(call.kwargs["data"])
                assert body["post"]
                posts.extend(body["post"])
        assert len(posts) == 2
        parent = next(p for p in posts if p["parent_run_id"] is None)
        child = next(p for p in posts if p["parent_run_id"] is not None)
        assert child["parent_run_id"] == parent["id"]


def test_traceable_project_name() -> None:
    with tracing_context(enabled=True):
        mock_client_ = _get_mock_client()

        @traceable(client=mock_client_, project_name="my foo project")
        def my_function(a: int, b: int, d: int) -> int:
            return a + b + d

        my_function(1, 2, 3)
        # Inspect the mock_calls and asser tthat "my foo project" is in
        # the session_name arg of the body
        mock_calls = _get_calls(mock_client_, minimum=1)
        assert 1 <= len(mock_calls) <= 2
        call = mock_calls[0]
        assert call.args[0] == "POST"
        assert call.args[1].startswith("https://api.smith.langchain.com")
        body = json.loads(call.kwargs["data"])
        assert body["post"]
        assert body["post"][0]["session_name"] == "my foo project"

        # reset
        mock_client_ = _get_mock_client()

        @traceable(client=mock_client_, project_name="my bar project")
        def my_other_function(run_tree) -> int:
            return my_function(1, 2, 3)

        my_other_function()  # type: ignore
        # Inspect the mock_calls and assert that "my bar project" is in
        # both all POST runs in the single request. We want to ensure
        # all runs in a trace are associated with the same project.
        mock_calls = _get_calls(mock_client_, minimum=1)
        assert 1 <= len(mock_calls) <= 2
        call = mock_calls[0]
        assert call.args[0] == "POST"
        assert call.args[1].startswith("https://api.smith.langchain.com")
        body = json.loads(call.kwargs["data"])
        assert body["post"]
        assert body["post"][0]["session_name"] == "my bar project"
        assert body["post"][1]["session_name"] == "my bar project"


def test_is_traceable_function(mock_client: Client) -> None:
    @traceable(client=mock_client)
    def my_function(a: int, b: int, d: int) -> int:
        return a + b + d

    assert is_traceable_function(my_function)


def test_is_traceable_partial_function(mock_client: Client) -> None:
    @traceable(client=mock_client)
    def my_function(a: int, b: int, d: int) -> int:
        return a + b + d

    partial_function = functools.partial(my_function, 1, 2)

    assert is_traceable_function(partial_function)


def test_is_not_traceable_function() -> None:
    def my_function(a: int, b: int, d: int) -> int:
        return a + b + d

    assert not is_traceable_function(my_function)


def test_is_traceable_class_call(mock_client: Client) -> None:
    class Foo:
        @traceable(client=mock_client)
        def __call__(self, a: int, b: int) -> None:
            pass

    assert is_traceable_function(Foo())


def test_is_not_traceable_class_call() -> None:
    class Foo:
        def __call__(self, a: int, b: int) -> None:
            pass

    assert not is_traceable_function(Foo())


def test_traceable_warning() -> None:
    with warnings.catch_warnings(record=True) as warning_records:
        warnings.simplefilter("always")

        @traceable(run_type="invalid_run_type")  # type: ignore
        def my_function() -> None:
            pass

        assert len(warning_records) == 1
        assert issubclass(warning_records[0].category, UserWarning)
        assert "Unrecognized run_type: invalid_run_type" in str(
            warning_records[0].message
        )
        assert "Did you mean @traceable(name='invalid_run_type')?" in str(
            warning_records[0].message
        )


def test_traceable_wrong_run_type_pos_arg() -> None:
    with warnings.catch_warnings(record=True) as warning_records:
        warnings.simplefilter("always")

        @traceable("my_run_type")  # type: ignore
        def my_function() -> None:
            pass

        assert len(warning_records) == 1
        assert issubclass(warning_records[0].category, UserWarning)
        assert "Unrecognized run_type: my_run_type" in str(warning_records[0].message)
        assert "Did you mean @traceable(name='my_run_type')?" in str(
            warning_records[0].message
        )


def test_traceable_too_many_pos_args() -> None:
    with warnings.catch_warnings(record=True) as warning_records:
        warnings.simplefilter("always")

        @traceable("chain", "my_function")  # type: ignore
        def my_function() -> None:
            pass

        assert len(warning_records) == 1
        assert issubclass(warning_records[0].category, UserWarning)
        assert "only accepts one positional argument" in str(warning_records[0].message)


# Really hard to get contextvar propagation right for async generators
# prior to Python 3.10
@pytest.mark.skipif(
    sys.version_info < (3, 11),
    reason="Skipping for Python 3.10 or earlier",
)
async def test_async_generator():
    @traceable
    def some_sync_func(query: str) -> list:
        return [query, query]

    @traceable
    async def some_async_func(queries: list) -> AsyncGenerator[list, None]:
        await asyncio.sleep(0.01)
        for query in queries:
            yield query

    @traceable
    async def another_async_func(query: str) -> str:
        rid = uuid.uuid4()
        with langsmith.trace(
            name="zee-cm", inputs={"query": query}, run_id=rid
        ) as run_tree:
            run_tree.end(outputs={"query": query})
            assert run_tree.id == rid
        return query

    @traceable
    async def create_document_context(documents: list) -> str:
        await asyncio.sleep(0.01)
        return "\n".join(documents)

    @traceable
    async def summarize_answers(
        query: str, document_context: str
    ) -> AsyncGenerator[str, None]:
        await asyncio.sleep(0.01)
        for i in range(3):
            yield f"Answer {i}"

    @traceable(run_type="chain", name="expand_and_answer_questions")
    async def my_answer(
        query: str,
    ) -> AsyncGenerator[Any, None]:
        expanded_terms = some_sync_func(query=query)
        docs_gen = some_async_func(
            queries=expanded_terms,
        )
        documents = []
        async for document in docs_gen:
            documents.append(document)
            break

        await another_async_func(query=query)

        for document in documents:
            yield document
        async for document in docs_gen:
            documents.append(document)
            yield document

        document_context = await create_document_context(
            documents=documents,
        )

        final_answer = summarize_answers(query=query, document_context=document_context)
        async for chunk in final_answer:
            yield chunk

    run: Optional[RunTree] = None  # type: ignore

    def _get_run(r: RunTree) -> None:
        nonlocal run
        run = r

    mock_client_ = _get_mock_client()
    with tracing_context(enabled=True):
        chunks = my_answer(
            "some_query", langsmith_extra={"on_end": _get_run, "client": mock_client_}
        )
        all_chunks = []
        async for chunk in chunks:
            all_chunks.append(chunk)

    assert all_chunks == [
        "some_query",
        "some_query",
        "Answer 0",
        "Answer 1",
        "Answer 2",
    ]
    assert run is not None
    run = cast(RunTree, run)
    assert run.name == "expand_and_answer_questions"
    child_runs = run.child_runs
    assert child_runs and len(child_runs) == 5
    names = [run.name for run in child_runs]
    assert names == [
        "some_sync_func",
        "some_async_func",
        "another_async_func",
        "create_document_context",
        "summarize_answers",
    ]
    assert len(child_runs[2].child_runs) == 1  # type: ignore


def test_generator():
    @traceable
    def some_sync_func(query: str) -> list:
        return [query, query]

    @traceable
    def some_func(queries: list) -> Generator[list, None, None]:
        for query in queries:
            yield query

    @traceable
    def another_func(query: str) -> str:
        with langsmith.trace(name="zee-cm", inputs={"query": query}) as run_tree:
            run_tree.end(outputs={"query": query})
        return query

    @traceable
    def create_document_context(documents: list) -> str:
        return "\n".join(documents)

    @traceable
    def summarize_answers(
        query: str, document_context: str
    ) -> Generator[str, None, None]:
        for i in range(3):
            yield f"Answer {i}"

    @traceable(run_type="chain", name="expand_and_answer_questions")
    def my_answer(
        query: str,
    ) -> Generator[Any, None, None]:
        expanded_terms = some_sync_func(query=query)
        docs_gen = some_func(
            queries=expanded_terms,
        )
        documents = []
        for document in docs_gen:
            documents.append(document)
            break

        another_func(query=query)

        for document in documents:
            yield document
        for document in docs_gen:
            documents.append(document)
            yield document

        document_context = create_document_context(
            documents=documents,
        )

        final_answer = summarize_answers(query=query, document_context=document_context)
        for chunk in final_answer:
            yield chunk

    run: Optional[RunTree] = None  # type: ignore

    def _get_run(r: RunTree) -> None:
        nonlocal run
        run = r

    mock_client_ = _get_mock_client()

    with tracing_context(enabled=True):
        chunks = my_answer(
            "some_query",
            langsmith_extra={
                "name": "test_overridding_name",
                "on_end": _get_run,
                "client": mock_client_,
            },
        )
        all_chunks = []
        for chunk in chunks:
            all_chunks.append(chunk)

    assert all_chunks == [
        "some_query",
        "some_query",
        "Answer 0",
        "Answer 1",
        "Answer 2",
    ]
    assert run is not None
    run = cast(RunTree, run)
    assert run.name == "test_overridding_name"
    child_runs = run.child_runs
    assert child_runs and len(child_runs) == 5
    names = [run.name for run in child_runs]
    assert names == [
        "some_sync_func",
        "some_func",
        "another_func",
        "create_document_context",
        "summarize_answers",
    ]
    assert len(child_runs[2].child_runs) == 1  # type: ignore


def test_traceable_regular():
    @traceable
    def some_sync_func(query: str, **kwargs: Any) -> list:
        assert kwargs == {"a": 1, "b": 2}
        return [query, query]

    @traceable
    def some_func(queries: list) -> list:
        return queries

    @traceable
    def another_func(query: str) -> str:
        with langsmith.trace(name="zee-cm", inputs={"query": query}) as run_tree:
            run_tree.end(outputs={"query": query})
        return query

    @traceable
    def create_document_context(documents: list) -> str:
        return "\n".join(documents)

    @traceable
    def summarize_answers(query: str, document_context: str) -> list:
        return [f"Answer {i}" for i in range(3)]

    @traceable(run_type="chain", name="expand_and_answer_questions")
    def my_answer(
        query: str,
    ) -> list:
        expanded_terms = some_sync_func(query=query, a=1, b=2)
        documents = some_func(
            queries=expanded_terms,
        )

        another_func(query=query)

        document_context = create_document_context(
            documents=documents,
        )

        final_answer = summarize_answers(query=query, document_context=document_context)
        return documents + final_answer

    run: Optional[RunTree] = None  # type: ignore

    def _get_run(r: RunTree) -> None:
        nonlocal run
        run = r

    mock_client_ = _get_mock_client()
    with tracing_context(enabled=True):
        all_chunks = my_answer(
            "some_query", langsmith_extra={"on_end": _get_run, "client": mock_client_}
        )

    assert all_chunks == [
        "some_query",
        "some_query",
        "Answer 0",
        "Answer 1",
        "Answer 2",
    ]
    assert run is not None
    run = cast(RunTree, run)
    assert run.name == "expand_and_answer_questions"
    child_runs = run.child_runs
    assert child_runs and len(child_runs) == 5
    names = [run.name for run in child_runs]
    assert names == [
        "some_sync_func",
        "some_func",
        "another_func",
        "create_document_context",
        "summarize_answers",
    ]
    assert len(child_runs[2].child_runs) == 1  # type: ignore


async def test_traceable_async():
    @traceable
    def some_sync_func(query: str) -> list:
        return [query, query]

    @traceable
    async def some_async_func(queries: list, *, required: str, **kwargs: Any) -> list:
        assert required == "foo"
        assert kwargs == {"a": 1, "b": 2}
        await asyncio.sleep(0.01)
        return queries

    @traceable
    async def another_async_func(query: str) -> str:
        with langsmith.trace(name="zee-cm", inputs={"query": query}) as run_tree:
            run_tree.end(outputs={"query": query})
        return query

    @traceable
    async def create_document_context(documents: list) -> str:
        await asyncio.sleep(0.01)
        return "\n".join(documents)

    @traceable
    async def summarize_answers(query: str, document_context: str) -> list:
        await asyncio.sleep(0.01)
        return [f"Answer {i}" for i in range(3)]

    @traceable(run_type="chain", name="expand_and_answer_questions")
    async def my_answer(
        query: str,
    ) -> list:
        expanded_terms = some_sync_func(query=query)
        documents = await some_async_func(
            queries=expanded_terms, required="foo", a=1, b=2
        )

        await another_async_func(query=query)

        document_context = await create_document_context(
            documents=documents,
        )

        final_answer = await summarize_answers(
            query=query, document_context=document_context
        )
        return documents + final_answer

    run: Optional[RunTree] = None  # type: ignore

    def _get_run(r: RunTree) -> None:
        nonlocal run
        run = r

    mock_client_ = _get_mock_client()
    with tracing_context(enabled=True):
        all_chunks = await my_answer(
            "some_query", langsmith_extra={"on_end": _get_run, "client": mock_client_}
        )

    assert all_chunks == [
        "some_query",
        "some_query",
        "Answer 0",
        "Answer 1",
        "Answer 2",
    ]
    assert run is not None
    run = cast(RunTree, run)
    assert run.name == "expand_and_answer_questions"
    child_runs = run.child_runs
    assert child_runs and len(child_runs) == 5
    names = [run.name for run in child_runs]
    assert names == [
        "some_sync_func",
        "some_async_func",
        "another_async_func",
        "create_document_context",
        "summarize_answers",
    ]
    assert len(child_runs[2].child_runs) == 1  # type: ignore


def test_traceable_to_trace():
    @traceable
    def parent_fn(a: int, b: int) -> int:
        with langsmith.trace(name="child_fn", inputs={"a": a, "b": b}) as run_tree:
            result = a + b
            run_tree.end(outputs={"result": result})
        return result

    run: Optional[RunTree] = None  # type: ignore

    def _get_run(r: RunTree) -> None:
        nonlocal run
        run = r

    with tracing_context(enabled=True):
        result = parent_fn(
            1, 2, langsmith_extra={"on_end": _get_run, "client": _get_mock_client()}
        )

    assert result == 3
    assert run is not None
    run = cast(RunTree, run)
    assert run.name == "parent_fn"
    assert run.outputs == {"output": 3}
    assert run.inputs == {"a": 1, "b": 2}
    child_runs = run.child_runs
    assert child_runs
    assert len(child_runs) == 1
    assert child_runs[0].name == "child_fn"
    assert child_runs[0].inputs == {"a": 1, "b": 2}


async def test_traceable_to_atrace():
    @traceable
    async def great_grandchild_fn(a: int, b: int) -> int:
        return a + b

    @traceable
    async def parent_fn(a: int, b: int) -> int:
        async with langsmith.trace(
            name="child_fn", inputs={"a": a, "b": b}
        ) as run_tree:
            async with langsmith.trace(
                "grandchild_fn", inputs={"a": a, "b": b, "c": "oh my"}
            ) as run_tree_gc:
                try:
                    async with langsmith.trace("expect_error", inputs={}):
                        raise ValueError("oh no")
                except ValueError:
                    pass
                result = await great_grandchild_fn(a, b)
                run_tree_gc.end(outputs={"result": result})
            run_tree.end(outputs={"result": result})
        return result

    run: Optional[RunTree] = None  # type: ignore

    def _get_run(r: RunTree) -> None:
        nonlocal run
        run = r

    with tracing_context(enabled=True):
        result = await parent_fn(
            1, 2, langsmith_extra={"on_end": _get_run, "client": _get_mock_client()}
        )

    assert result == 3
    assert run is not None
    run = cast(RunTree, run)
    assert run.name == "parent_fn"
    assert run.outputs == {"output": 3}
    assert run.inputs == {"a": 1, "b": 2}
    child_runs = run.child_runs
    assert child_runs
    assert len(child_runs) == 1
    child = child_runs[0]
    assert child.name == "child_fn"
    assert child.inputs == {"a": 1, "b": 2}
    assert len(child.child_runs) == 1
    grandchild = child.child_runs[0]
    assert grandchild.name == "grandchild_fn"
    assert grandchild.inputs == {"a": 1, "b": 2, "c": "oh my"}
    assert len(grandchild.child_runs) == 2
    ggcerror = grandchild.child_runs[0]
    assert ggcerror.name == "expect_error"
    assert "oh no" in str(ggcerror.error)
    ggc = grandchild.child_runs[1]
    assert ggc.name == "great_grandchild_fn"
    assert ggc.inputs == {"a": 1, "b": 2}


def test_trace_to_traceable():
    @traceable
    def child_fn(a: int, b: int) -> int:
        return a + b

    mock_client_ = _get_mock_client()
    with tracing_context(enabled=True):
        rid = uuid.uuid4()
        with langsmith.trace(
            name="parent_fn", inputs={"a": 1, "b": 2}, client=mock_client_, run_id=rid
        ) as run:
            result = child_fn(1, 2)
            run.end(outputs={"result": result})
            assert run.id == rid

    assert result == 3
    assert run.name == "parent_fn"
    assert run.outputs == {"result": 3}
    assert run.inputs == {"a": 1, "b": 2}
    child_runs = run.child_runs
    assert child_runs
    assert len(child_runs) == 1
    assert child_runs[0].name == "child_fn"
    assert child_runs[0].inputs == {"a": 1, "b": 2}


def test_client_passed_when_traceable_parent():
    mock_client = _get_mock_client()
    rt = RunTree(name="foo", client=mock_client)
    headers = rt.to_headers()

    @traceable
    def my_run(foo: str):
        return {"baz": "buzz"}

    my_run(foo="bar", langsmith_extra={"parent": headers, "client": mock_client})
    mock_calls = _get_calls(mock_client)
    assert len(mock_calls) == 1
    call = mock_client.session.request.call_args
    assert call.args[0] == "POST"
    assert call.args[1].startswith("https://api.smith.langchain.com")
    body = json.loads(call.kwargs["data"])
    assert body["post"]
    assert body["post"][0]["inputs"] == {"foo": "bar"}
    assert body["post"][0]["outputs"] == {"baz": "buzz"}


def test_client_passed_when_trace_parent():
    mock_client = _get_mock_client()
    rt = RunTree(name="foo", client=mock_client)
    headers = rt.to_headers()
    with tracing_context(enabled=True):
        with trace(
            name="foo", inputs={"foo": "bar"}, parent=headers, client=mock_client
        ) as rt:
            rt.outputs["bar"] = "baz"
    calls = _get_calls(mock_client)
    assert len(calls) == 1
    call = calls[0]
    assert call.args[0] == "POST"
    assert call.args[1].startswith("https://api.smith.langchain.com")
    body = json.loads(call.kwargs["data"])
    assert body["post"]
    assert body["post"][0]["inputs"] == {"foo": "bar"}
    assert body["post"][0]["outputs"] == {"bar": "baz"}


def test_from_runnable_config():
    try:
        from langchain_core.tools import tool  # type: ignore
        from langchain_core.tracers.langchain import LangChainTracer  # type: ignore
    except ImportError:
        pytest.skip("Skipping test that requires langchain")

    gc_run_id = uuid.uuid4()

    @tool
    def my_grandchild_tool(text: str, callbacks: Any = None) -> str:
        """Foo."""
        lct: LangChainTracer = callbacks.handlers[0]
        assert str(gc_run_id) in lct.run_map
        run = lct.run_map[str(gc_run_id)]
        assert run.name == "my_grandchild_tool"
        assert run.run_type == "tool"
        assert lct.project_name == "foo"
        parent_run = lct.run_map[str(run.parent_run_id)]
        assert parent_run
        assert parent_run.name == "my_traceable"
        assert parent_run.run_type == "retriever"
        grandparent_run = lct.run_map[str(parent_run.parent_run_id)]
        assert grandparent_run
        assert grandparent_run.name == "my_tool"
        assert grandparent_run.run_type == "tool"
        return text

    @traceable(run_type="retriever")
    def my_traceable(text: str) -> str:
        rt = get_current_run_tree()
        assert rt
        assert rt.run_type == "retriever"
        assert rt.parent_run_id
        assert rt.parent_run
        assert rt.parent_run.run_type == "tool"
        assert rt.session_name == "foo"
        return my_grandchild_tool.invoke({"text": text}, {"run_id": gc_run_id})

    @tool
    def my_tool(text: str) -> str:
        """Foo."""
        return my_traceable(text)

    mock_client = _get_mock_client()
    tracer = LangChainTracer(client=mock_client, project_name="foo")
    my_tool.invoke({"text": "hello"}, {"callbacks": [tracer]})


def test_io_interops():
    try:
        from langchain_core.language_models import FakeListChatModel
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_core.runnables import RunnableLambda
        from langchain_core.tracers import LangChainTracer
    except ImportError:
        pytest.skip("Skipping test that requires langchain")
    tracer = LangChainTracer(client=_get_mock_client(auto_batch_tracing=False))
    stage_added = {
        "parent_input": {"original_input": "original_input_value"},
        "child_input": {"parent_input": "parent_input_value"},
        "child_output": {"child_output": "child_output_value"},
        "parent_output": {"parent_output": "parent_output_value"},
    }

    llm = FakeListChatModel(responses=["bar"])
    prompt = ChatPromptTemplate.from_messages([("system", "Hi {name}")])
    some_chain = prompt | llm

    @RunnableLambda
    def child(inputs: dict) -> dict:
        res = some_chain.invoke({"name": "foo"})
        assert res.content == "bar"
        return {**stage_added["child_output"], **inputs}

    @RunnableLambda
    def the_parent(inputs: dict) -> dict:
        return {
            **stage_added["parent_output"],
            **child.invoke({**stage_added["child_input"], **inputs}),
        }

    expected_at_stage = {}
    current = {}
    for stage in stage_added:
        current = {**current, **stage_added[stage]}
        expected_at_stage[stage] = current
    parent_result = the_parent.invoke(
        stage_added["parent_input"], {"callbacks": [tracer]}
    )
    assert parent_result == expected_at_stage["parent_output"]
    mock_posts = _get_calls(tracer.client, minimum=5)
    assert len(mock_posts) == 5
    datas = [json.loads(mock_post.kwargs["data"]) for mock_post in mock_posts]
    names = [
        "the_parent",
        "child",
        "RunnableSequence",
        "ChatPromptTemplate",
        "FakeListChatModel",
    ]
    contains_serialized = {"ChatPromptTemplate", "FakeListChatModel"}
    ids_contains_serialized = set()
    for n, d in zip(names, datas):
        assert n == d["name"]
        if n in contains_serialized:
            assert d["serialized"]
            assert "graph" not in d["serialized"]
            ids_contains_serialized.add(d["id"])
        else:
            assert d.get("serialized") is None

    assert datas[0]["name"] == "the_parent"
    assert datas[0]["inputs"] == expected_at_stage["parent_input"]
    assert not datas[0]["outputs"]
    assert datas[1]["name"] == "child"
    assert datas[1]["inputs"] == expected_at_stage["child_input"]
    assert not datas[1]["outputs"]
    ids = {d["name"]: d["id"] for d in datas}

    # Check the patch requests
    mock_patches = _get_calls(tracer.client, verbs={"PATCH"}, minimum=5)
    assert len(mock_patches) == 5
    patches_datas = [
        json.loads(mock_patch.kwargs["data"]) for mock_patch in mock_patches
    ]
    patches_dict = {d["id"]: d for d in patches_datas}
    child_patch = patches_dict[ids["child"]]
    assert child_patch["outputs"] == expected_at_stage["child_output"]
    assert child_patch["inputs"] == expected_at_stage["child_input"]
    assert child_patch["name"] == "child"
    parent_patch = patches_dict[ids["the_parent"]]
    assert parent_patch["outputs"] == expected_at_stage["parent_output"]
    assert parent_patch["inputs"] == expected_at_stage["parent_input"]
    assert parent_patch["name"] == "the_parent"
    for d in patches_datas:
        if d["id"] in ids_contains_serialized:
            assert "serialized" not in d or d.get("serialized")
        else:
            assert d.get("serialized") is None


def test_trace_respects_tracing_context():
    mock_client = _get_mock_client()
    with tracing_context(enabled=False):
        with trace(name="foo", inputs={"a": 1}, client=mock_client):
            pass

    mock_calls = _get_calls(mock_client)
    assert not mock_calls


def test_trace_nested_enable_disable():
    # Test that you can disable then re-enable tracing
    # and the trace connects as expected
    mock_client = _get_mock_client()
    with tracing_context(enabled=True):
        with trace(name="foo", inputs={"a": 1}, client=mock_client) as run:
            with tracing_context(enabled=False):
                with trace(name="bar", inputs={"b": 2}, client=mock_client) as run2:
                    with tracing_context(enabled=True):
                        with trace(
                            name="baz", inputs={"c": 3}, client=mock_client
                        ) as run3:
                            run3.end(outputs={"c": 3})
                            run2.end(outputs={"b": 2})
                            run.end(outputs={"a": 1})

    # Now we need to ensure that there are 2 runs created (2 posts and 2 patches),
    # run -> run3
    # with run2 being invisible
    mock_calls = _get_calls(mock_client, verbs={"POST", "PATCH"})
    datas = [json.loads(mock_post.kwargs["data"]) for mock_post in mock_calls]
    assert "post" in datas[0]
    posted = datas[0]["post"]
    assert len(posted) == 2
    assert posted[0]["name"] == "foo"
    assert posted[1]["name"] == "baz"
    dotted_parts = posted[1]["dotted_order"].split(".")
    assert len(dotted_parts) == 2
    parent_dotted = posted[0]["dotted_order"]
    assert parent_dotted == dotted_parts[0]


def test_tracing_disabled_project_name_set():
    mock_client = _get_mock_client()

    @traceable
    def foo(a: int) -> int:
        return a

    with tracing_context(enabled=False):
        with trace(
            name="foo", inputs={"a": 1}, client=mock_client, project_name="my_project"
        ):
            pass
        foo(1, langsmith_extra={"client": mock_client, "project_name": "my_project"})

    mock_calls = _get_calls(mock_client)
    assert not mock_calls


@pytest.mark.parametrize("auto_batch_tracing", [True, False])
async def test_traceable_async_exception(auto_batch_tracing: bool):
    mock_client = _get_mock_client(
        auto_batch_tracing=auto_batch_tracing,
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

    @traceable
    async def my_function(a: int) -> int:
        raise ValueError("foo")

    with tracing_context(enabled=True):
        with pytest.raises(ValueError, match="foo"):
            await my_function(1, langsmith_extra={"client": mock_client})

    # Get ALL the call args for the mock_client
    num_calls = 1 if auto_batch_tracing else 2
    mock_calls = _get_calls(
        mock_client, verbs={"POST", "PATCH", "GET"}, minimum=num_calls
    )
    assert len(mock_calls) >= num_calls


@pytest.mark.parametrize("auto_batch_tracing", [True, False])
async def test_traceable_async_gen_exception(auto_batch_tracing: bool):
    mock_client = _get_mock_client(
        auto_batch_tracing=auto_batch_tracing,
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

    @traceable
    async def my_function(a: int) -> AsyncGenerator[int, None]:
        for i in range(5):
            yield i
        raise ValueError("foo")

    with tracing_context(enabled=True):
        with pytest.raises(ValueError, match="foo"):
            async for _ in my_function(1, langsmith_extra={"client": mock_client}):
                pass

    # Get ALL the call args for the mock_client
    num_calls = 1 if auto_batch_tracing else 2
    mock_calls = _get_calls(
        mock_client, verbs={"POST", "PATCH", "GET"}, minimum=num_calls
    )

    assert len(mock_calls) == num_calls
    if auto_batch_tracing:
        datas = _get_datas(mock_calls)
        outputs = [p["outputs"] for _, p in datas if p.get("outputs")]
        assert len(outputs) == 1
        assert outputs[0]["output"] == list(range(5))


@pytest.mark.parametrize("auto_batch_tracing", [True, False])
async def test_traceable_gen_exception(auto_batch_tracing: bool):
    mock_client = _get_mock_client(
        auto_batch_tracing=auto_batch_tracing,
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

    @traceable
    def my_function(a: int) -> Generator[int, None, None]:
        for i in range(5):
            yield i
        raise ValueError("foo")

    with tracing_context(enabled=True):
        with pytest.raises(ValueError, match="foo"):
            for _ in my_function(1, langsmith_extra={"client": mock_client}):
                pass

    # Get ALL the call args for the mock_client
    num_calls = 1 if auto_batch_tracing else 2
    mock_calls = _get_calls(
        mock_client, verbs={"POST", "PATCH", "GET"}, minimum=num_calls
    )

    assert len(mock_calls) == num_calls
    if auto_batch_tracing:
        datas = _get_datas(mock_calls)
        outputs = [p["outputs"] for _, p in datas if p.get("outputs")]
        assert len(outputs) == 1
        assert outputs[0]["output"] == list(range(5))


@pytest.mark.parametrize("env_var", [True, False])
@pytest.mark.parametrize("context", [True, False, None])
async def test_trace_respects_env_var(env_var: bool, context: Optional[bool]):
    ls_utils.get_env_var.cache_clear()
    mock_client = _get_mock_client()
    with patch.dict(os.environ, {"LANGSMITH_TRACING": "true" if env_var else "false "}):
        with tracing_context(enabled=context):
            with trace(name="foo", inputs={"a": 1}, client=mock_client) as run:
                assert run.name == "foo"
                pass
            async with trace(name="bar", inputs={"b": 2}, client=mock_client) as run2:
                assert run2.name == "bar"
                pass

    mock_calls = _get_calls(mock_client)
    if context is None:
        expect = env_var
    else:
        expect = context
    if expect:
        assert len(mock_calls) >= 1
    else:
        assert not mock_calls


async def test_process_inputs_outputs():
    mock_client = _get_mock_client()
    in_s = "what's life's meaning"

    def process_inputs(inputs: dict) -> dict:
        assert inputs == {"val": in_s, "ooblek": "nada"}
        inputs["val2"] = "this is mutated"
        return {"serialized_in": "what's the meaning of life?"}

    def process_outputs(outputs: int) -> dict:
        assert outputs == 42
        return {"serialized_out": 24}

    @traceable(process_inputs=process_inputs, process_outputs=process_outputs)
    def my_function(val: str, **kwargs: Any) -> int:
        assert not kwargs.get("val2")
        return 42

    with tracing_context(enabled=True):
        my_function(
            in_s,
            ooblek="nada",
            langsmith_extra={"client": mock_client},
        )

    def _check_client(client: Client) -> None:
        mock_calls = _get_calls(client)
        assert len(mock_calls) == 1
        call = mock_calls[0]
        assert call.args[0] == "POST"
        assert call.args[1].startswith("https://api.smith.langchain.com")
        body = json.loads(call.kwargs["data"])
        assert body["post"]
        assert body["post"][0]["inputs"] == {
            "serialized_in": "what's the meaning of life?"
        }
        assert body["post"][0]["outputs"] == {"serialized_out": 24}

    _check_client(mock_client)

    class Untruthy:
        def __init__(self, val: Any) -> None:
            self.val = val

        def __bool__(self) -> bool:
            raise ValueError("I'm not truthy")

        def __eq__(self, other: Any) -> bool:
            if isinstance(other, Untruthy):
                return self.val == other.val
            return self.val == other

    @traceable(process_inputs=process_inputs, process_outputs=process_outputs)
    async def amy_function(val: str, **kwargs: Any) -> int:
        assert not kwargs.get("val2")
        return Untruthy(42)  # type: ignore

    mock_client = _get_mock_client()
    with tracing_context(enabled=True):
        await amy_function(
            in_s,
            ooblek="nada",
            langsmith_extra={"client": mock_client},
        )

    _check_client(mock_client)

    # Do generator

    def reducer(outputs: list) -> dict:
        return {"reduced": outputs[0]}

    def process_reduced_outputs(outputs: dict) -> dict:
        assert outputs == {"reduced": 42}
        return {"serialized_out": 24}

    @traceable(
        process_inputs=process_inputs,
        process_outputs=process_reduced_outputs,
        reduce_fn=reducer,
    )
    def my_gen(val: str, **kwargs: Any) -> Generator[int, None, None]:
        assert not kwargs.get("val2")
        yield 42

    mock_client = _get_mock_client()
    with tracing_context(enabled=True):
        result = list(
            my_gen(
                in_s,
                ooblek="nada",
                langsmith_extra={"client": mock_client},
            )
        )
        assert result == [42]

    _check_client(mock_client)

    @traceable(
        process_inputs=process_inputs,
        process_outputs=process_reduced_outputs,
        reduce_fn=reducer,
    )
    async def amy_gen(val: str, **kwargs: Any) -> AsyncGenerator[int, None]:
        assert not kwargs.get("val2")
        yield Untruthy(42)  # type: ignore

    mock_client = _get_mock_client()
    with tracing_context(enabled=True):
        result = [
            i
            async for i in amy_gen(
                in_s, ooblek="nada", langsmith_extra={"client": mock_client}
            )
        ]
        assert result == [42]
    _check_client(mock_client)


def test_traceable_stop_iteration():
    def my_generator():
        yield from range(5)
        return ("last", "vals")

    def consume(gen):
        last_vals = yield from gen()
        assert last_vals == ("last", "vals")

    assert list(consume(my_generator)) == list(range(5))

    wrapped = traceable(my_generator)
    assert list(consume(wrapped)) == list(range(5))


def test_context_client():
    c = Client(session=MagicMock())
    original = get_cached_client()
    with tracing_context(client=c):
        assert get_cached_client() == c
        assert RunTree().client == c
    assert get_cached_client() == original
