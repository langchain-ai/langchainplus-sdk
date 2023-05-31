"""Decorator for creating a run tree from functions."""

import inspect
from functools import wraps
from typing import Any, Callable, Dict, Optional, Union

from click import UUID

from langchainplus_sdk.schemas import RunTree, RunTypeEnum


def _get_inputs(*args: Any, **kwargs: Any) -> Dict[str, Any]:
    """Return a dictionary of inputs from the function signature."""
    # TODO: Could inspect and map names...
    # TODO: Handle non-json-serializable inputs
    return {"args": args, "kwargs": kwargs}


def run_tree(
    run_type: Union[RunTypeEnum, str],
    *,
    name: Optional[str] = None,
    serialized: Optional[Dict] = None,
    extra: Optional[Dict] = None,
) -> Callable:
    """Decorator for creating or adding a run to a run tree."""
    extra_outer = extra or {}

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(
            *args: Any,
            session_name: Optional[str] = None,
            session_id: Optional[UUID] = None,
            reference_example_id: Optional[UUID] = None,
            run_id: Optional[UUID] = None,
            extra: Optional[Dict] = None,
            **kwargs: Any,
        ) -> Any:
            """Create a new run or create_child() if run is passed in kwargs."""
            signature = inspect.signature(func)
            name_ = name or func.__name__
            if extra:
                extra_inner = {**extra_outer, **extra}
            else:
                extra_inner = extra_outer
            if "run" in kwargs:
                run = kwargs.pop("run", None)
                if not isinstance(run, RunTree):
                    raise TypeError("run must be a RunTree")
                inputs = _get_inputs(*args, **kwargs)
                child_run = run.create_child(
                    name=name_,
                    run_type=run_type,
                    run_id=run_id,
                    serialized=serialized,
                    inputs=inputs,
                    extra=extra_inner,
                )
            else:
                inputs = _get_inputs(*args, **kwargs)
                child_run = RunTree(
                    name=name_,
                    serialized=serialized or {"name": name},
                    inputs=inputs,
                    run_type=run_type,
                    reference_example_id=reference_example_id,
                    session_id=session_id,
                    session_name=session_name,
                    extra=extra_inner,
                )
            child_run.post()
            try:
                if "run" in signature.parameters:
                    function_result = func(*args, run=child_run, **kwargs)
                else:
                    if not kwargs:
                        function_result = func(*args)
                    else:
                        function_result = func(*args, **kwargs)
            except Exception as e:
                child_run.end(error=str(e))
                child_run.patch()
                raise e
            child_run.end(outputs={"output": function_result})
            child_run.patch()
            return function_result

        return wrapper

    return decorator
