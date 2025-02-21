# mypy: disable-error-code="attr-defined, union-attr, arg-type, call-overload"
import json
import time
from unittest import mock

import pytest

from langsmith import Client
from langsmith.wrappers import wrap_anthropic
from tests.unit_tests.test_run_helpers import _get_calls

model_name = "claude-3-haiku-20240307"


@pytest.mark.parametrize("stream", [False, True])
def test_chat_sync_api(stream: bool):
    import anthropic  # noqa

    mock_session = mock.MagicMock()
    mock_client = Client(session=mock_session)
    original_client = anthropic.Anthropic()
    patched_client = wrap_anthropic(
        anthropic.Anthropic(), tracing_extra={"client": mock_client}
    )
    messages = [{"role": "user", "content": "Say 'foo'"}]

    if stream:
        original = original_client.messages.stream(
            messages=messages,
            temperature=0,
            model=model_name,
            max_tokens=3,
        )
        patched = patched_client.messages.stream(
            messages=messages,
            temperature=0,
            model=model_name,
            max_tokens=3,
        )
        with original as om:
            original_chunks = list(om.text_stream)
        with patched as pm:
            patched_chunks = list(pm.text_stream)
        assert len(original_chunks) == len(patched_chunks)
        assert "".join(original_chunks) == "".join(patched_chunks)
    else:
        original = original_client.messages.create(
            messages=messages,
            temperature=0,
            model=model_name,
            max_tokens=3,
        )
        patched = patched_client.messages.create(
            messages=messages,
            temperature=0,
            model=model_name,
            max_tokens=3,
        )
        assert isinstance(patched, type(original))
        assert "".join([c.text for c in original.content]) == "".join(
            [c.text for c in patched.content]
        )

    calls = _get_calls(mock_client, minimum=1)
    assert calls
    datas = [json.loads(call.kwargs["data"]) for call in calls]
    outputs = None
    for data in datas:
        if data.get("post"):
            if outputs := data["post"][0]["outputs"]:
                break
        if data.get("patch"):
            outputs = data["patch"][0]["outputs"]
            break

    assert outputs


@pytest.mark.parametrize("stream", [False, True])
async def test_chat_async_api(stream: bool):
    import anthropic  # noqa

    mock_session = mock.MagicMock()
    mock_client = Client(session=mock_session)
    original_client = anthropic.AsyncAnthropic()
    patched_client = wrap_anthropic(
        anthropic.AsyncAnthropic(), tracing_extra={"client": mock_client}
    )
    messages = [{"role": "user", "content": "Say 'foo'"}]

    if stream:
        original_chunks, patched_chunks = [], []
        async with original_client.messages.stream(
            messages=messages,
            temperature=0,
            model=model_name,
            max_tokens=3,
        ) as stream:
            async for chunk in stream:
                original_chunks.append(chunk)
        async with patched_client.messages.stream(
            messages=messages,
            temperature=0,
            model=model_name,
            max_tokens=3,
        ) as stream:
            async for chunk in stream:
                patched_chunks.append(chunk)
        assert len(original_chunks) == len(patched_chunks)

        assert "".join(
            [
                c.message.content[0].text
                for c in original_chunks
                if hasattr(c, "message") and len(c.message.content)
            ]
        ) == "".join(
            [
                c.message.content[0].text
                for c in patched_chunks
                if hasattr(c, "message") and len(c.message.content)
            ]
        )
    else:
        original = await original_client.messages.create(
            messages=messages,
            temperature=0,
            model=model_name,
            max_tokens=3,
        )
        patched = await patched_client.messages.create(
            messages=messages,
            temperature=0,
            model=model_name,
            max_tokens=3,
        )
        assert isinstance(patched, type(original))
        assert "".join([c.text for c in original.content]) == "".join(
            [c.text for c in patched.content]
        )

    time.sleep(1)
    assert mock_session.request.call_count > 1
    # This is the info call
    assert mock_session.request.call_args_list[0][0][0].upper() == "GET"
    for call in mock_session.request.call_args_list[1:]:
        assert call[0][0].upper() == "POST"


@pytest.mark.parametrize("stream", [False, True])
def test_completions_sync_api(stream: bool):
    import anthropic

    mock_session = mock.MagicMock()
    mock_client = Client(session=mock_session)
    original_client = anthropic.Anthropic()
    patched_client = wrap_anthropic(
        anthropic.Anthropic(), tracing_extra={"client": mock_client}
    )
    prompt = "Human: Say 'Hi i'm Claude' then stop.\n\nAssistant:"
    original = original_client.completions.create(
        model="claude-2.1",
        prompt=prompt,
        temperature=0,
        stream=stream,
        max_tokens_to_sample=3,
    )
    patched = patched_client.completions.create(
        model="claude-2.1",
        prompt=prompt,
        temperature=0,
        stream=stream,
        max_tokens_to_sample=3,
    )
    if stream:
        original_chunks = list(original)
        patched_chunks = list(patched)
        assert len(original_chunks) == len(patched_chunks)
        assert "".join([c.completion for c in original_chunks]) == "".join(
            [c.completion for c in patched_chunks]
        )
    else:
        assert isinstance(patched, type(original))
        assert original.completion == patched.completion

    time.sleep(1)
    assert mock_session.request.call_count > 1
    # This is the info call
    assert mock_session.request.call_args_list[0][0][0].upper() == "GET"
    for call in mock_session.request.call_args_list[1:]:
        assert call[0][0].upper() == "POST"


@pytest.mark.parametrize("stream", [False, True])
async def test_completions_async_api(stream: bool):
    import anthropic

    mock_session = mock.MagicMock()
    mock_client = Client(session=mock_session)
    original_client = anthropic.AsyncAnthropic()
    patched_client = wrap_anthropic(
        anthropic.AsyncAnthropic(), tracing_extra={"client": mock_client}
    )
    prompt = "Human: Say 'Hi i'm Claude' then stop.\n\nAssistant:"
    original = await original_client.completions.create(
        model="claude-2.1",
        prompt=prompt,
        temperature=0,
        stream=stream,
        max_tokens_to_sample=3,
    )
    patched = await patched_client.completions.create(
        model="claude-2.1",
        prompt=prompt,
        temperature=0,
        stream=stream,
        max_tokens_to_sample=3,
    )
    if stream:
        original_chunks = [chunk async for chunk in original]
        patched_chunks = [chunk async for chunk in patched]
        assert len(original_chunks) == len(patched_chunks)
        assert "".join([c.completion for c in original_chunks]) == "".join(
            [c.completion for c in patched_chunks]
        )
    else:
        assert isinstance(patched, type(original))
        assert original.completion == patched.completion

    time.sleep(1)
    assert mock_session.request.call_count > 1
    # This is the info call
    assert mock_session.request.call_args_list[0][0][0].upper() == "GET"
    for call in mock_session.request.call_args_list[1:]:
        assert call[0][0].upper() == "POST"


def test_beta_chat_sync_api():
    import anthropic  # noqa
    from tests.unit_tests.test_run_helpers import _get_calls

    mock_session = mock.MagicMock()
    mock_client = Client(session=mock_session)
    original_client = anthropic.Anthropic()
    patched_client = wrap_anthropic(
        anthropic.Anthropic(), tracing_extra={"client": mock_client}
    )
    messages = [{"role": "user", "content": "Say 'foo'"}]

    original = original_client.beta.messages.create(
        messages=messages,
        temperature=0,
        model=model_name,
        max_tokens=3,
    )
    patched = patched_client.beta.messages.create(
        messages=messages,
        temperature=0,
        model=model_name,
        max_tokens=3,
    )
    assert isinstance(patched, type(original))
    assert "".join([c.text for c in original.content]) == "".join(
        [c.text for c in patched.content]
    )

    calls = _get_calls(mock_client, minimum=1)
    assert calls
    datas = [json.loads(call.kwargs["data"]) for call in calls]
    outputs = None
    for data in datas:
        if data.get("post"):
            if outputs := data["post"][0]["outputs"]:
                break
        if data.get("patch"):
            outputs = data["patch"][0]["outputs"]
            break

    assert outputs


async def test_beta_chat_async_api():
    import anthropic  # noqa

    mock_session = mock.MagicMock()
    mock_client = Client(session=mock_session)
    original_client = anthropic.AsyncAnthropic()
    patched_client = wrap_anthropic(
        anthropic.AsyncAnthropic(), tracing_extra={"client": mock_client}
    )
    messages = [{"role": "user", "content": "Say 'foo'"}]

    original = await original_client.beta.messages.create(
        messages=messages,
        temperature=0,
        model=model_name,
        max_tokens=3,
    )
    patched = await patched_client.beta.messages.create(
        messages=messages,
        temperature=0,
        model=model_name,
        max_tokens=3,
    )
    assert isinstance(patched, type(original))
    assert "".join([c.text for c in original.content]) == "".join(
        [c.text for c in patched.content]
    )

    time.sleep(1)
    assert mock_session.request.call_count > 1
    # This is the info call
    assert mock_session.request.call_args_list[0][0][0].upper() == "GET"
    for call in mock_session.request.call_args_list[1:]:
        assert call[0][0].upper() == "POST"
