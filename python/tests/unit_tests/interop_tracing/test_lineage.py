import asyncio
from concurrent import futures
from typing import Any, Literal, Optional
from unittest.mock import MagicMock

import pytest
from langchain_core.runnables import Runnable, RunnableConfig

from langsmith import Client, trace, traceable
from langsmith.run_helpers import get_current_run_tree, tracing_context
from tests.unit_tests.interop_tracing.utils import extract_span_tree


def _get_mock_client() -> Client:
    mock_session = MagicMock()
    client = Client(session=mock_session, api_key="test")
    return client


@pytest.fixture
def mock_client() -> Client:
    """Get a mock client."""
    return _get_mock_client()


_SYNC_METHODS = ["invoke", "batch", "stream"]
_ASYNC_METHODS = ["ainvoke", "abatch", "astream", "astream_events"]
ALL_METHODS = _SYNC_METHODS + _ASYNC_METHODS


def _sync_execute_runnable(
    runnable: Runnable[Any, Any],
    method: Literal["invoke", "batch", "stream"],
    inputs: Any,
    *,
    config: Optional[RunnableConfig] = None,
) -> Any:
    """Execute a runnable synchronously."""
    if method == "invoke":
        return runnable.invoke(inputs, config)
    elif method == "batch":
        return (runnable.batch([inputs], config))[0]
    elif method == "stream":
        output = None
        for chunk in runnable.stream(inputs, config):
            if output is None:
                output = chunk
            else:
                try:
                    output += chunk
                except TypeError:
                    output = chunk
    else:
        raise NotImplementedError(f"Unsupported method {method}")


async def _async_execute_runnable(
    runnable: Runnable[Any, Any],
    method: Literal[
        "invoke", "batch", "stream", "ainvoke", "abatch", "astream_events", "astream"
    ],
    inputs: Any,
    *,
    config: Optional[RunnableConfig] = None,
) -> Any:
    """Execute a runnable synchronously."""
    if method == "ainvoke":
        return await runnable.ainvoke(inputs, config)
    elif method == "abatch":
        return (await runnable.abatch([inputs], config))[0]
    elif method == "astream":
        output = None
        async for chunk in runnable.astream(inputs, config):
            if output is None:
                output = chunk
            else:
                try:
                    output += chunk
                except TypeError:
                    output = chunk
    elif method == "astream_events":
        final_event = None
        async for event in runnable.astream_events(inputs, config, version="v2"):
            final_event = event
        if final_event is None:
            raise ValueError("No final event received")
        return final_event["data"]["output"]
    elif method in {"invoke", "batch", "stream"}:
        return _sync_execute_runnable(runnable, method, inputs, config=config)
    else:
        raise NotImplementedError(f"Unsupported method {method}")


def test_simple_lineage(mock_client: Client) -> None:
    """Test that the tracing context is enabled"""
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        def child(x: int):
            return x

        @traceable(client=mock_client)
        def parent(x: int):
            return child(x + 1)

        @traceable(client=mock_client)
        def grand_parent(x: int):
            return parent(x + 1)

        assert grand_parent(1) == 3

    tree = extract_span_tree(mock_client)
    assert len(tree.get_root_nodes()) == 1
    sorted_spans = tree.get_breadth_first_traversal()
    assert len(sorted_spans) == 3
    names = [span["name"] for span in sorted_spans]
    assert names == ["grand_parent", "parent", "child"]


async def test_async_simple_lineage(mock_client: Client) -> None:
    """Test that the tracing context is enabled"""
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        async def child(x: int):
            return x

        @traceable(client=mock_client)
        async def parent(x: int):
            return await child(x + 1)

        @traceable(client=mock_client)
        async def grand_parent(x: int):
            return await parent(x + 1)

        assert await grand_parent(1) == 3

    tree = extract_span_tree(mock_client)
    assert len(tree.get_root_nodes()) == 1
    sorted_spans = tree.get_breadth_first_traversal()
    assert len(sorted_spans) == 3
    names = [span["name"] for span in sorted_spans]
    assert names == ["grand_parent", "parent", "child"]


@pytest.mark.xfail(reason="Known issue with threadpool.")
async def test_async_sync_simple_lineage(mock_client: Client) -> None:
    """Test invoking sync code from async and vice versa."""
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        async def child(x: int):
            return x

        @traceable(client=mock_client)
        def parent(x: int):
            # Invoke on a separate thread

            with futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, child(x + 1))
                return future.result()

        @traceable(client=mock_client)
        async def grand_parent(x: int):
            return parent(x + 1)

        assert await grand_parent(1) == 3

    tree = extract_span_tree(mock_client)
    assert len(tree.get_root_nodes()) == 1
    sorted_spans = tree.get_breadth_first_traversal()
    assert len(sorted_spans) == 3
    names = [span["name"] for span in sorted_spans]
    assert names == ["grand_parent", "parent", "child"]


async def test_async_sync_simple_lineage_with_parent(mock_client: Client) -> None:
    """Test invoking sync code from async and vice versa."""
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        async def child(x: int):
            return x

        @traceable(client=mock_client)
        def parent(x: int):
            # Invoke on a separate thread
            rt = get_current_run_tree()
            with futures.ThreadPoolExecutor() as executor:
                future = executor.submit(
                    asyncio.run, child(x + 1, langsmith_extra={"parent": rt})
                )
                return future.result()

        @traceable(client=mock_client)
        async def grand_parent(x: int):
            return parent(x + 1)

        assert await grand_parent(1) == 3

    tree = extract_span_tree(mock_client)
    assert len(tree.get_root_nodes()) == 1
    sorted_spans = tree.get_breadth_first_traversal()
    assert len(sorted_spans) == 3
    names = [span["name"] for span in sorted_spans]
    assert names == ["grand_parent", "parent", "child"]


def test_recursive_depth_10(mock_client: Client) -> None:
    """Test recursive invocation."""
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        def recursive(x: int):
            if x == 0:
                return 0
            return recursive(x - 1)

        assert recursive(10) == 0

    tree = extract_span_tree(mock_client)
    assert len(tree.get_root_nodes()) == 1
    sorted_spans = tree.get_breadth_first_traversal()
    assert len(sorted_spans) == 11
    names = [span["name"] for span in sorted_spans]
    assert names == ["recursive"] * 11


async def test_async_recursive_depth_10(mock_client: Client) -> None:
    """Test recursive invocation."""
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        async def recursive(x: int):
            if x == 0:
                return 0
            return await recursive(x - 1)

        assert await recursive(10) == 0

    tree = extract_span_tree(mock_client)
    assert len(tree.get_root_nodes()) == 1
    sorted_spans = tree.get_breadth_first_traversal()
    assert len(sorted_spans) == 11
    names = [span["name"] for span in sorted_spans]
    assert names == ["recursive"] * 11


def test_fibonacci(mock_client: Client) -> None:
    """Test recursive invocation."""
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        def fib(n: int):
            if n <= 1:
                return n
            return fib(n - 1) + fib(n - 2)

        assert fib(10) == 55

    tree = extract_span_tree(mock_client)
    sorted_spans = tree.get_breadth_first_traversal()
    assert len(sorted_spans) == 177
    names = [span["name"] for span in sorted_spans]
    assert names == ["fib"] * 177


async def test_async_fibonacci(mock_client: Client) -> None:
    """Test recursive invocation."""
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        async def fib(n: int):
            if n <= 1:
                return n
            return await fib(n - 1) + await fib(n - 2)

        assert await fib(10) == 55

    tree = extract_span_tree(mock_client)
    sorted_spans = tree.get_breadth_first_traversal()
    assert len(sorted_spans) == 177
    names = [span["name"] for span in sorted_spans]
    assert names == ["fib"] * 177


async def test_mixed_sync_async_fibonacci(mock_client: Client) -> None:
    """Test recursive invocation."""
    with tracing_context(enabled=True):

        @traceable(client=mock_client)
        def sync_fib(n: int):
            if n <= 1:
                return n
            return sync_fib(n - 1) + sync_fib(n - 2)

        @traceable(client=mock_client)
        async def fib(n: int):
            if n <= 1:
                return n
            return await fib(n - 1) + sync_fib(n - 2)

        assert await fib(10) == 55
    tree = extract_span_tree(mock_client)
    sorted_spans = tree.get_breadth_first_traversal()
    assert len(sorted_spans) == 177


@pytest.mark.parametrize("method", _SYNC_METHODS)
async def test_tracing_within_runnables(
    method: Literal["invoke", "batch", "stream"],
) -> None:
    from langchain_core.runnables import RunnableLambda
    from langchain_core.tracers import LangChainTracer

    mock_client = _get_mock_client()

    tracer = LangChainTracer(client=mock_client)
    with tracing_context(enabled=True):

        @traceable()
        def foo(x: int):
            return x + 1

        @traceable()
        def bar(x: int):
            return foo(x + 1)

        bar_ = RunnableLambda(bar)
        _sync_execute_runnable(bar_, method, 1, config={"callbacks": [tracer]})

    tree = extract_span_tree(mock_client)
    sorted_spans = tree.get_breadth_first_traversal(
        include_level=False, attributes=["name"]
    )
    # Bar is traced twice! Once from the RunnableLambda and once
    # from the traceable decorator
    assert sorted_spans == [{"name": "bar"}, {"name": "bar"}, {"name": "foo"}]


async def test_tags(mock_client: Client) -> None:
    with tracing_context(enabled=True):
        # Check that a child's tag is applied properly
        # What are the correct semantics?
        @traceable(tags=["child-tag"], metadata={"a": "b"}, client=mock_client)
        def child(x: int):
            return x + 1

        @traceable(tags=["parent-tag"], client=mock_client)
        def parent(x: int):
            return child(x + 1)

        parent(3)

    span_tree = extract_span_tree(mock_client)
    nodes = span_tree.get_breadth_first_traversal(
        include_level=False, attributes=["name", "tags"]
    )
    assert nodes == [
        {"name": "parent", "tags": ["parent-tag"]},
        {"name": "child", "tags": ["parent-tag", "child-tag"]},
    ]


@pytest.mark.parametrize("method", ALL_METHODS)
async def test_runnable_lambdas(mock_client: Client, method: str):
    """Test runnable lambdas."""
    from langchain_core.runnables import RunnableLambda
    from langchain_core.tracers import LangChainTracer

    tracer = LangChainTracer(client=mock_client)

    with tracing_context(enabled=True):

        @RunnableLambda
        def foo(inputs):
            return inputs

        @RunnableLambda
        def bar(inputs):
            return foo.invoke(inputs)

        await _async_execute_runnable(
            bar,
            # Complains about method being Literal vs. str
            method,  # type:ignore[arg-type]
            {"x": 1},
            config={"callbacks": [tracer]},
        )

    span_tree = extract_span_tree(mock_client)
    nodes = span_tree.get_breadth_first_traversal(
        attributes=["name", "inputs", "outputs"]
    )
    assert nodes == [
        {"inputs": {"x": 1}, "name": "bar", "outputs": {"x": 1}},
        {"inputs": {"x": 1}, "name": "foo", "outputs": {"x": 1}},
    ]


@pytest.mark.parametrize("method", ALL_METHODS)
async def test_runnable_sequence(mock_client: Client, method: str) -> None:
    """Test composition with runnable sequence."""
    from langchain_core.runnables import RunnableLambda
    from langchain_core.tracers import LangChainTracer

    tracer = LangChainTracer(client=mock_client)

    with tracing_context(enabled=True):

        @RunnableLambda
        def foo(inputs):
            return inputs

        @RunnableLambda
        def bar(inputs):
            return inputs

        @traceable(client=mock_client)
        def buzz(inputs):
            return inputs

        chain = (foo | bar | buzz).with_config({"run_name": "chain"})

        await _async_execute_runnable(
            chain,
            # Complains about method being Literal vs. str
            method,  # type:ignore[arg-type]
            {"x": 1},
            config={"callbacks": [tracer]},
        )

    span_tree = extract_span_tree(mock_client)
    nodes = span_tree.get_breadth_first_traversal(attributes=["name"])
    names = [node["name"] for node in nodes]
    # Buzz gets doubly traced b/c of the traceable decorator
    assert names == ["chain", "foo", "bar", "buzz", "buzz"]


@pytest.mark.parametrize("method", ALL_METHODS)
async def test_with_tracing(mock_client: Client, method: str) -> None:
    """Test composition with runnable sequence."""
    from langchain_core.runnables import RunnableLambda
    from langchain_core.tracers import LangChainTracer

    tracer = LangChainTracer(client=mock_client)

    with tracing_context(enabled=True):

        @RunnableLambda
        def bar(inputs):
            return inputs

        @RunnableLambda
        def foo(inputs):
            with trace(name="nested_group", inputs=inputs, client=mock_client):
                return bar.invoke(inputs)

        chain = foo

        await _async_execute_runnable(
            chain,
            # Complains about method being Literal vs. str
            method,  # type:ignore[arg-type]
            {"x": 1},
            config={"callbacks": [tracer]},
        )

    span_tree = extract_span_tree(mock_client)
    nodes_and_levels = span_tree.get_breadth_first_traversal(
        attributes=["name"], include_level=True
    )
    names = [(node["name"], level) for node, level in nodes_and_levels]
    # Buzz gets doubly traced b/c of the traceable decorator
    assert names == [("foo", 0), ("nested_group", 1), ("bar", 2)]
