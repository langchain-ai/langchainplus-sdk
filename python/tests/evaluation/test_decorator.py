import os
import time

import pytest

from langsmith import testing as t


@pytest.mark.skipif(
    not os.getenv("LANGSMITH_TRACING"),
    reason="LANGSMITH_TRACING environment variable not set",
)
@pytest.mark.langsmith
@pytest.mark.parametrize("c", list(range(10)))
async def test_addition_single(c):
    x = 3
    y = 4
    t.log_inputs({"x": x, "y": y, "c": c})

    expected = 7 + c
    t.log_reference_outputs({"sum": expected})

    actual = x + y + c
    t.log_outputs({"sum": actual})

    t.log_feedback(key="foo", score=1)

    assert actual == expected


async def my_app():
    return "hello"


@pytest.mark.skipif(
    not os.getenv("LANGSMITH_TRACING"),
    reason="LANGSMITH_TRACING environment variable not set",
)
@pytest.mark.langsmith
async def test_openai_says_hello():
    # Traced code will be included in the test case
    text = "Say hello!"
    response = await my_app()
    t.log_inputs({"text": text})
    t.log_outputs({"response": response})
    t.log_reference_outputs({"response": "hello!"})

    # Use this context manager to trace any steps used for generating evaluation
    # feedback separately from the main application logic
    with t.trace_feedback():
        grade = 1 if "hello" in response else 0
        t.log_feedback(key="llm_judge", score=grade)

    assert "hello" in response.lower()


@pytest.mark.skipif(
    not os.getenv("LANGSMITH_TRACING"),
    reason="LANGSMITH_TRACING environment variable not set",
)
@pytest.mark.xfail(reason="Test failure output case")
@pytest.mark.langsmith(reference_output_keys=["expected"])
@pytest.mark.parametrize(
    "a, b, expected",
    [
        (1, 2, 3),
        (3, 4, 7),
    ],
)
async def test_addition_parametrized(a: int, b: int, expected: int):
    t.log_outputs({"sum": a + b})
    assert a + b != expected


@pytest.mark.skipif(
    not os.getenv("LANGSMITH_TRACING"),
    reason="LANGSMITH_TRACING environment variable not set",
)
@pytest.mark.langsmith
@pytest.mark.parametrize("a,b", [[i, i] for i in range(20)])
def test_param(a, b):
    t.log_outputs({"sum": a + b})
    t.log_reference_outputs({"sum": a + b})
    assert a + b == a + b


@pytest.fixture
def inputs() -> int:
    return 5


@pytest.fixture
def reference_outputs() -> int:
    return 10


@pytest.mark.skipif(
    not os.getenv("LANGSMITH_TRACING"),
    reason="LANGSMITH_TRACING environment variable not set",
)
@pytest.mark.langsmith(reference_output_keys=["reference_outputs"])
def test_fixture(inputs: int, reference_outputs: int):
    result = 2 * inputs
    t.log_outputs({"d": result})
    assert result == reference_outputs


@pytest.mark.skipif(
    not os.getenv("LANGSMITH_TRACING"),
    reason="LANGSMITH_TRACING environment variable not set",
)
@pytest.mark.langsmith
def test_slow_test():
    t.log_inputs({"slow": "I am slow"})
    time.sleep(5)
    t.log_outputs({"slow_result": "I am slow"})
    t.log_reference_outputs({"slow_result": "I am not fast"})
