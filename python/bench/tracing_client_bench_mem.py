from datetime import datetime, timezone
from typing import Dict
from uuid import uuid4
import time
import os

from langsmith.client import Client

from memory_profiler import profile


def create_large_json(length: int) -> Dict:
    """Create a large JSON object for benchmarking purposes."""
    large_array = [
        {
            "index": i,
            "data": f"This is element number {i}",
            "nested": {"id": i, "value": f"Nested value for element {i}"},
        }
        for i in range(length)
    ]

    return {
        "name": "Huge JSON",
        "description": "This is a very large JSON object for benchmarking purposes.",
        "array": large_array,
        "metadata": {
            "created_at": "2024-10-22T19:00:00Z",
            "author": "Python Program",
            "version": 1.0,
        },
    }


def create_run_data(run_id: str, json_size: int) -> Dict:
    """Create a single run data object."""

    start_time, end_time = (
        datetime.now(timezone.utc),
        datetime.now(timezone.utc),
    )

    dotted_order = f"{start_time.strftime('%Y%m%dT%H%M%S%fZ')}{run_id}"

    return {
        "name": "Run Name",
        "id": run_id,
        "run_type": "chain",
        "inputs": create_large_json(json_size),
        "outputs": create_large_json(json_size),
        "extra": {"extra_data": "value"},
        "trace_id": run_id,
        "dotted_order": dotted_order,
        "tags": ["tag1", "tag2"],
        "session_name": "Session Name",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
    }


@profile
def benchmark_run_creation(json_size, num_runs) -> None:
    """Benchmark the creation of runs."""

    client = Client(
        api_url="https://beta.api.smith.langchain.com",
        api_key=os.environ["LANGSMITH_API_KEY"],
    )

    project_name = "__tracing_client_bench_mem_" + datetime.now().strftime("%Y%m%dT%H%M%S")

    for _ in range(num_runs):
        run = create_run_data(str(uuid4()), json_size)
        client.create_run(**run, project_name=project_name)
        time.sleep(0.05)


def main():
    """
    Run benchmarks with different combinations of parameters and report results.
    """

    json_size = 7_500
    num_runs = 1000

    benchmark_run_creation(json_size, num_runs)

if __name__ == "__main__":
    main()