from bench.utils import create_large_json, create_run_data
from uuid import uuid4
import time
import threading
from pathlib import Path
import orjson
import lmdb
import io
import zstandard as zstd
from memory_profiler import profile

NUM_RUNS = 0
NUM_THREADS = 1
BATCH_SIZE = 300


def insert_run_into_db(env, run):
    """Insert a run into LMDB."""
    # Serialize the run data
    inputs = orjson.dumps(run['inputs'])
    outputs = orjson.dumps(run['outputs'])

    # Create an index entry for ordering
    inputs_key = f"pending:{run['trace_id']}:{run['dotted_order']}:inputs".encode(
        'utf-8')
    outputs_key = f"pending:{run['trace_id']}:{run['dotted_order']}:outputs".encode(
        'utf-8')

    with env.begin(write=True) as txn:
        # Store the run data
        txn.put(inputs_key, inputs)
        txn.put(outputs_key, outputs)


def process_batch(env, compressor):
    """Process a single batch of runs and return the number of processed runs."""
    keys_to_delete = []

    with env.begin(write=False) as txn:
        cursor = txn.cursor()

        # Seek to first pending record
        prefix = b"pending:"
        if not cursor.set_range(prefix):
            return 0

        # Collect batch_size number of pending runs
        run_count = 0
        zstd_buffer = io.BytesIO()

        with compressor.stream_writer(zstd_buffer) as compressor_stream:
            while cursor.key().startswith(prefix) and run_count < BATCH_SIZE:
                index_key = cursor.key()
                run_data = cursor.value()

                # Write to compression buffer
                compressor_stream.write(run_data)

                # Track items to update
                keys_to_delete.append(index_key)

                run_count += 1
                if not cursor.next():
                    break
            compressed_size = zstd_buffer.tell()

    if run_count > 0:
        print("Sending compressed buffer of size: ", compressed_size)
        time.sleep(0.150)
        print(f"Processed {run_count} runs")

        # Delete the processed runs
        with env.begin(write=True) as txn:
            for key in keys_to_delete:
                txn.delete(key)

        global NUM_RUNS
        NUM_RUNS += run_count
        return run_count

    return 0


def run_processor(env, stop_event):
    """Background thread function to fetch runs and process them."""
    compressor = zstd.ZstdCompressor(level=3)

    while not stop_event.is_set():
        run_count = process_batch(env, compressor)

        # if run_count == 0:
        #     time.sleep(0.500)  # No runs found, wait before checking again
        #     continue

    # Drain remaining runs
    print("Stop event set, draining remaining runs...")
    while True:
        run_count = process_batch(env, compressor)
        if run_count == 0:
            print("Draining complete")
            break

@profile
def benchmark_run_creation(json_size, num_runs) -> None:
    """Benchmark the creation of runs."""
    # delete the existing database file
    db_path = Path("runs.lmdb")
    if db_path.exists():
        for file in db_path.glob("*"):
            file.unlink()
        db_path.rmdir()

    # Create new database with generous size
    map_size = 5 * 1024 * 1024 * 1024  # 5 GB
    env = lmdb.open(
        str(db_path),
        map_size=map_size,
        sync=False,  # Disable fsync after commit
        writemap=True,  # Use writeable memory mapping
        map_async=True,  # Don't wait for disk writes
    )

    print("Creating runs...")
    inputs, outputs = create_large_json(json_size), create_large_json(json_size)
    runs = [create_run_data(str(uuid4()), inputs, outputs) for _ in range(num_runs)]
    print("Runs created.")

    stop_event = threading.Event()
    processor_threads = []
    for _ in range(NUM_THREADS):
        processor_thread = threading.Thread(target=run_processor, args=(env, stop_event))
        processor_thread.start()
        processor_threads.append(processor_thread)

    start = time.perf_counter()

    for run in runs:
        insert_run_into_db(env, run)

    # Signal the processor thread to stop
    stop_event.set()

    # Join the processor threads
    for processor_thread in processor_threads:
        processor_thread.join()

    print("Time taken to insert runs: ", time.perf_counter() - start)
    print("Total runs processed: ", NUM_RUNS)

    env.close()


def main():
    """Run benchmarks with specified parameters."""
    json_size = 5_000
    num_runs = 2_000

    benchmark_run_creation(json_size, num_runs)


if __name__ == "__main__":
    main()
