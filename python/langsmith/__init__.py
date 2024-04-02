"""LangSmith Client."""

from typing import Any


def __getattr__(name: str) -> Any:
    if name == "__version__":
        try:
            from importlib import metadata

            return metadata.version(__package__)
        except metadata.PackageNotFoundError:
            return ""
    elif name == "Client":
        from langsmith.client import Client

        return Client
    elif name == "RunTree":
        from langsmith.run_trees import RunTree

        return RunTree
    elif name == "EvaluationResult":
        from langsmith.evaluation.evaluator import EvaluationResult

        return EvaluationResult
    elif name == "RunEvaluator":
        from langsmith.evaluation.evaluator import RunEvaluator

        return RunEvaluator
    elif name == "trace":
        from langsmith.run_helpers import trace

        return trace
    elif name == "traceable":
        from langsmith.run_helpers import traceable

        return traceable

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "Client",
    "RunTree",
    "__version__",
    "EvaluationResult",
    "RunEvaluator",
    "traceable",
    "trace",
]
