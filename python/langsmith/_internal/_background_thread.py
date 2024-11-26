from __future__ import annotations

import functools
import logging
import sys
import threading
import weakref
from queue import Empty, Queue
from typing import (
    TYPE_CHECKING,
    List,
    Union,
    cast,
)

from langsmith import schemas as ls_schemas
from langsmith._internal._constants import (
    _AUTO_SCALE_DOWN_NEMPTY_TRIGGER,
    _AUTO_SCALE_UP_NTHREADS_LIMIT,
    _AUTO_SCALE_UP_QSIZE_TRIGGER,
)
from langsmith._internal._operations import (
    SerializedFeedbackOperation,
    SerializedRunOperation,
    combine_serialized_queue_operations,
)

if TYPE_CHECKING:
    from langsmith.client import Client

logger = logging.getLogger("langsmith.client")


@functools.total_ordering
class TracingQueueItem:
    """An item in the tracing queue.

    Attributes:
        priority (str): The priority of the item.
        action (str): The action associated with the item.
        item (Any): The item itself.
    """

    priority: str
    item: Union[SerializedRunOperation, SerializedFeedbackOperation]

    __slots__ = ("priority", "item")

    def __init__(
        self,
        priority: str,
        item: Union[SerializedRunOperation, SerializedFeedbackOperation],
    ) -> None:
        self.priority = priority
        self.item = item

    def __lt__(self, other: TracingQueueItem) -> bool:
        return (self.priority, self.item.__class__) < (
            other.priority,
            other.item.__class__,
        )

    def __eq__(self, other: object) -> bool:
        return isinstance(other, TracingQueueItem) and (
            self.priority,
            self.item.__class__,
        ) == (other.priority, other.item.__class__)


def _tracing_thread_drain_queue(
    tracing_queue: Queue, limit: int = 100, block: bool = True
) -> List[TracingQueueItem]:
    next_batch: List[TracingQueueItem] = []
    try:
        # wait 250ms for the first item, then
        # - drain the queue with a 50ms block timeout
        # - stop draining if we hit the limit
        # shorter drain timeout is used instead of non-blocking calls to
        # avoid creating too many small batches
        if item := tracing_queue.get(block=block, timeout=0.25):
            next_batch.append(item)
        while item := tracing_queue.get(block=block, timeout=0.05):
            next_batch.append(item)
            if limit and len(next_batch) >= limit:
                break
    except Empty:
        pass
    return next_batch


def _tracing_thread_handle_batch(
    client: Client,
    tracing_queue: Queue,
    batch: List[TracingQueueItem],
    use_multipart: bool,
) -> None:
    try:
        ops = combine_serialized_queue_operations([item.item for item in batch])
        if True:
            client._multipart_ingest_ops(ops)
        else:
            if any(isinstance(op, SerializedFeedbackOperation) for op in ops):
                logger.warn(
                    "Feedback operations are not supported in non-multipart mode"
                )
                ops = [
                    op for op in ops if not isinstance(op, SerializedFeedbackOperation)
                ]
            client._batch_ingest_run_ops(cast(List[SerializedRunOperation], ops))

    except Exception:
        logger.error("Error in tracing queue", exc_info=True)
        # exceptions are logged elsewhere, but we need to make sure the
        # background thread continues to run
        pass
    finally:
        for _ in batch:
            tracing_queue.task_done()


def _ensure_ingest_config(
    info: ls_schemas.LangSmithInfo,
) -> ls_schemas.BatchIngestConfig:
    default_config = ls_schemas.BatchIngestConfig(
        use_multipart_endpoint=False,
        size_limit_bytes=None,  # Note this field is not used here
        size_limit=100,
        scale_up_nthreads_limit=_AUTO_SCALE_UP_NTHREADS_LIMIT,
        scale_up_qsize_trigger=_AUTO_SCALE_UP_QSIZE_TRIGGER,
        scale_down_nempty_trigger=_AUTO_SCALE_DOWN_NEMPTY_TRIGGER,
    )
    if not info:
        return default_config
    try:
        if not info.batch_ingest_config:
            return default_config
        return info.batch_ingest_config
    except BaseException:
        return default_config


def tracing_control_thread_func(client_ref: weakref.ref[Client]) -> None:
    client = client_ref()
    if client is None:
        return
    tracing_queue = client.tracing_queue
    assert tracing_queue is not None
    batch_ingest_config = _ensure_ingest_config(client.info)
    size_limit: int = batch_ingest_config["size_limit"]
    scale_up_nthreads_limit: int = batch_ingest_config["scale_up_nthreads_limit"]
    scale_up_qsize_trigger: int = batch_ingest_config["scale_up_qsize_trigger"]
    use_multipart = batch_ingest_config.get("use_multipart_endpoint", False)

    sub_threads: List[threading.Thread] = []
    # 1 for this func, 1 for getrefcount, 1 for _get_data_type_cached
    num_known_refs = 3

    def keep_thread_active() -> bool:
        # if `client.cleanup()` was called, stop thread
        if not client or (
            hasattr(client, "_manual_cleanup") and client._manual_cleanup
        ):
            return False
        if not threading.main_thread().is_alive():
            # main thread is dead. should not be active
            return False

        if hasattr(sys, "getrefcount"):
            # check if client refs count indicates we're the only remaining
            # reference to the client
            return sys.getrefcount(client) > num_known_refs + len(sub_threads)
        else:
            # in PyPy, there is no sys.getrefcount attribute
            # for now, keep thread alive
            return True

    # loop until
    while keep_thread_active():
        for thread in sub_threads:
            if not thread.is_alive():
                sub_threads.remove(thread)
        if (
            len(sub_threads) < scale_up_nthreads_limit
            and tracing_queue.qsize() > scale_up_qsize_trigger
        ):
            new_thread = threading.Thread(
                target=_tracing_sub_thread_func,
                args=(weakref.ref(client), use_multipart),
            )
            sub_threads.append(new_thread)
            new_thread.start()
        if next_batch := _tracing_thread_drain_queue(tracing_queue, limit=size_limit):
            _tracing_thread_handle_batch(
                client, tracing_queue, next_batch, use_multipart
            )
    # drain the queue on exit
    while next_batch := _tracing_thread_drain_queue(
        tracing_queue, limit=size_limit, block=False
    ):
        _tracing_thread_handle_batch(client, tracing_queue, next_batch, use_multipart)


def _tracing_sub_thread_func(
    client_ref: weakref.ref[Client],
    use_multipart: bool,
) -> None:
    client = client_ref()
    if client is None:
        return
    try:
        if not client.info:
            return
    except BaseException as e:
        logger.debug("Error in tracing control thread: %s", e)
        return
    tracing_queue = client.tracing_queue
    assert tracing_queue is not None
    batch_ingest_config = _ensure_ingest_config(client.info)
    size_limit = batch_ingest_config.get("size_limit", 100)
    seen_successive_empty_queues = 0

    # loop until
    while (
        # the main thread dies
        threading.main_thread().is_alive()
        # or we've seen the queue empty 4 times in a row
        and seen_successive_empty_queues
        <= batch_ingest_config["scale_down_nempty_trigger"]
    ):
        if next_batch := _tracing_thread_drain_queue(tracing_queue, limit=size_limit):
            seen_successive_empty_queues = 0
            _tracing_thread_handle_batch(
                client, tracing_queue, next_batch, use_multipart
            )
        else:
            seen_successive_empty_queues += 1

    # drain the queue on exit
    while next_batch := _tracing_thread_drain_queue(
        tracing_queue, limit=size_limit, block=False
    ):
        _tracing_thread_handle_batch(client, tracing_queue, next_batch, use_multipart)
