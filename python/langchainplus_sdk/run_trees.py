"""Schemas for the langchainplus API."""
from __future__ import annotations

import logging
from concurrent.futures import Future, ThreadPoolExecutor
from datetime import datetime
from typing import Dict, List, Optional, Union
from uuid import UUID, uuid4

from pydantic import Field, root_validator

from langchainplus_sdk.client import LangChainPlusClient
from langchainplus_sdk.schemas import RunBase, RunTypeEnum, infer_default_run_values

logger = logging.getLogger(__name__)
_THREAD_POOL_EXECUTOR: Optional[ThreadPoolExecutor] = None


def _ensure_thread_pool() -> ThreadPoolExecutor:
    """Ensure a thread pool exists in the current context."""
    global _THREAD_POOL_EXECUTOR
    if _THREAD_POOL_EXECUTOR is None:
        _THREAD_POOL_EXECUTOR = ThreadPoolExecutor(max_workers=1)
    return _THREAD_POOL_EXECUTOR


def await_all_runs() -> None:
    """Flush the thread pool."""
    global _THREAD_POOL_EXECUTOR
    if _THREAD_POOL_EXECUTOR is not None:
        _THREAD_POOL_EXECUTOR.shutdown(wait=True)
        _THREAD_POOL_EXECUTOR = None


class RunTree(RunBase):
    """Run Schema with back-references for posting runs."""

    name: str
    id: UUID = Field(default_factory=uuid4)
    parent_run: Optional[RunTree] = Field(default=None, exclude=True)
    child_runs: List[RunTree] = Field(
        default_factory=list,
        exclude={"__all__": {"parent_run_id"}},
    )
    session_name: str = Field(default="default")
    session_id: Optional[UUID] = Field(default=None)
    execution_order: int = 1
    child_execution_order: int = Field(default=1, exclude=True)
    client: LangChainPlusClient = Field(
        default_factory=LangChainPlusClient, exclude=True
    )

    @root_validator(pre=True)
    def infer_defaults(cls, values: dict) -> dict:
        """Assign name to the run."""
        values = infer_default_run_values(values)
        if values.get("child_runs") is None:
            values["child_runs"] = []
        return values

    def end(
        self,
        *,
        outputs: Optional[Dict] = None,
        error: Optional[str] = None,
        end_time: Optional[datetime] = None,
    ) -> None:
        """Set the end time of the run and all child runs."""
        self.end_time = end_time or datetime.utcnow()
        if outputs is not None:
            self.outputs = outputs
        if error is not None:
            self.error = error
        if self.parent_run:
            self.parent_run.child_execution_order = max(
                self.parent_run.child_execution_order,
                self.child_execution_order,
            )

    def create_child(
        self,
        name: str,
        run_type: Union[str, RunTypeEnum],
        *,
        run_id: Optional[UUID] = None,
        serialized: Optional[Dict] = None,
        inputs: Optional[Dict] = None,
        outputs: Optional[Dict] = None,
        error: Optional[str] = None,
        reference_example_id: Optional[UUID] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        extra: Optional[Dict] = None,
    ) -> RunTree:
        """Add a child run to the run tree."""
        execution_order = self.child_execution_order + 1
        serialized_ = serialized or {"name": name}
        run = RunTree(
            name=name,
            id=run_id or uuid4(),
            serialized=serialized_,
            inputs=inputs or {},
            outputs=outputs or {},
            error=error,
            run_type=run_type,
            reference_example_id=reference_example_id,
            start_time=start_time or datetime.utcnow(),
            end_time=end_time or datetime.utcnow(),
            execution_order=execution_order,
            child_execution_order=execution_order,
            extra=extra or {},
            parent_run=self,
            session_name=self.session_name,
            client=self.client,
        )
        self.child_runs.append(run)
        return run

    def post(self, exclude_child_runs: bool = True) -> Future:
        """Post the run tree to the API asynchronously."""
        executor = _ensure_thread_pool()
        exclude = {"child_runs"} if exclude_child_runs else None
        kwargs = self.dict(exclude=exclude, exclude_none=True)
        return executor.submit(
            self.client.create_run,
            **kwargs,
        )

    def patch(self) -> Future:
        """Patch the run tree to the API in a background thread."""
        executor = _ensure_thread_pool()
        return executor.submit(
            self.client.update_run,
            run_id=self.id,
            outputs=self.outputs.copy() if self.outputs else None,
            error=self.error,
            parent_run_id=self.parent_run_id,
            reference_example_id=self.reference_example_id,
        )
