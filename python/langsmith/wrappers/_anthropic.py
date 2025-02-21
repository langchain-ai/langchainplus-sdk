from __future__ import annotations

import functools
import logging
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    List,
    Mapping,
    Optional,
    Type,
    TypeVar,
    Union,
)

from typing_extensions import TypedDict

from langsmith import client as ls_client
from langsmith import run_helpers

if TYPE_CHECKING:
    from anthropic import Anthropic, AsyncAnthropic
    from anthropic.types import (
        Completion,
        Message,
        MessageStreamEvent,
    )

C = TypeVar("C", bound=Union["Anthropic", "AsyncAnthropic", Any])
logger = logging.getLogger(__name__)


@functools.lru_cache
def _get_not_given() -> Optional[Type]:
    try:
        from anthropic._types import NotGiven

        return NotGiven
    except ImportError:
        return None


def _strip_not_given(d: dict) -> dict:
    try:
        not_given = _get_not_given()
        if not_given is None:
            return d
        return {k: v for k, v in d.items() if not isinstance(v, not_given)}
    except Exception as e:
        logger.error(f"Error stripping NotGiven: {e}")
        return d


def _accumulate_event(
    *, event: MessageStreamEvent, current_snapshot: Message | None
) -> Message | None:
    try:
        from anthropic.types import ContentBlock
    except ImportError:
        logger.debug("Error importing ContentBlock")
        return current_snapshot

    if current_snapshot is None:
        if event.type == "message_start":
            return event.message

        raise RuntimeError(
            f'Unexpected event order, got {event.type} before "message_start"'
        )

    if event.type == "content_block_start":
        # TODO: check index <-- from anthropic SDK :)
        current_snapshot.content.append(
            ContentBlock.construct(**event.content_block.model_dump()),  # type: ignore[attr-defined]
        )
    elif event.type == "content_block_delta":
        content = current_snapshot.content[event.index]
        if content.type == "text" and event.delta.type == "text_delta":
            content.text += event.delta.text
    elif event.type == "message_delta":
        current_snapshot.stop_reason = event.delta.stop_reason
        current_snapshot.stop_sequence = event.delta.stop_sequence
        current_snapshot.usage.output_tokens = event.usage.output_tokens

    return current_snapshot


def _reduce_chat(all_chunks: List) -> dict:
    full_message = None
    for chunk in all_chunks:
        try:
            full_message = _accumulate_event(event=chunk, current_snapshot=full_message)
        except RuntimeError as e:
            logger.debug(f"Error accumulating event in Anthropic Wrapper: {e}")
            return {"output": all_chunks}
    if full_message is None:
        return {"output": all_chunks}
    return full_message.model_dump()


def _reduce_completions(all_chunks: List[Completion]) -> dict:
    all_content = []
    for chunk in all_chunks:
        content = chunk.completion
        if content is not None:
            all_content.append(content)
    content = "".join(all_content)
    if all_chunks:
        d = all_chunks[-1].model_dump()
        d["choices"] = [{"text": content}]
    else:
        d = {"choices": [{"text": content}]}

    return d


def _get_wrapper(
    original_create: Callable,
    name: str,
    reduce_fn: Optional[Callable] = None,
    tracing_extra: Optional[TracingExtra] = None,
    force_stream: bool = False,
) -> Callable:
    textra = tracing_extra or {}

    @functools.wraps(original_create)
    def create(*args, **kwargs):
        stream = kwargs.get("stream")
        decorator = run_helpers.traceable(
            name=name,
            run_type="llm",
            reduce_fn=reduce_fn if force_stream or stream else None,
            process_inputs=_strip_not_given,
            **textra,
        )

        return decorator(original_create)(*args, **kwargs)

    @functools.wraps(original_create)
    async def acreate(*args, **kwargs):
        stream = kwargs.get("stream")
        decorator = run_helpers.traceable(
            name=name,
            run_type="llm",
            reduce_fn=reduce_fn if force_stream or stream else None,
            process_inputs=_strip_not_given,
            **textra,
        )
        return await decorator(original_create)(*args, **kwargs)

    return acreate if run_helpers.is_async(original_create) else create


class TracingExtra(TypedDict, total=False):
    metadata: Optional[Mapping[str, Any]]
    tags: Optional[List[str]]
    client: Optional[ls_client.Client]


def wrap_anthropic(client: C, *, tracing_extra: Optional[TracingExtra] = None) -> C:
    """Patch the Anthropic client to make it traceable.

    Args:
        client (Union[Anthropic, AsyncAnthropic]): The client to patch.
        tracing_extra (Optional[TracingExtra], optional): Extra tracing information.
            Defaults to None.

    Returns:
        Union[Anthropic, AsyncAnthropic]: The patched client.

    Example:

        .. code-block:: python

            import anthropic
            from langsmith import wrappers

            client = wrappers.wrap_anthropic(anthropic.Anthropic())

            # Use Anthropic client same as you normally would:
            system = "You are a helpful assistant."
            messages = [
                {
                    "role": "user",
                    "content": "What physics breakthroughs do you predict will happen by 2300?",
                }
            ]
            completion = client.messages.create(
                model="claude-3-5-sonnet-latest",
                messages=messages,
                max_tokens=1000,
                system=system,
            )
            print(completion.content)

    """  # noqa: E501
    client.messages.create = _get_wrapper(  # type: ignore[method-assign]
        client.messages.create,
        "ChatAnthropic",
        tracing_extra=tracing_extra,
    )
    client.messages.stream = _get_wrapper(  # type: ignore[method-assign]
        client.messages.stream,
        "ChatAnthropic",
        _reduce_chat,
        force_stream=True,
        tracing_extra=tracing_extra,
    )
    client.completions.create = _get_wrapper(  # type: ignore[method-assign]
        client.completions.create,
        "Anthropic",
        _reduce_completions,
        tracing_extra=tracing_extra,
    )

    if (
        hasattr(client, "beta")
        and hasattr(client.beta, "messages")
        and hasattr(client.beta.messages, "create")
    ):
        client.beta.messages.create = _get_wrapper(  # type: ignore[method-assign]
            client.beta.messages.create,  # type: ignore
            "Anthropic",
            tracing_extra=tracing_extra,
        )
    return client
