from datetime import datetime, timezone
from typing import Dict


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


def create_run_data(run_id: str, inputs: Dict, outputs: Dict) -> Dict:
    """Create a single run data object."""
    start_time = datetime.now(timezone.utc)
    end_time = datetime.now(timezone.utc)
    dotted_order = f"{start_time.strftime('%Y%m%dT%H%M%S%fZ')}{run_id}"

    return {
        "name": "Run Name",
        "id": run_id,
        "run_type": "chain",
        "inputs": inputs,
        "outputs": outputs,
        "extra": {"extra_data": "value"},
        "trace_id": run_id,
        "dotted_order": dotted_order,
        "tags": ["tag1", "tag2"],
        "session_name": "Session Name",
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
    }
