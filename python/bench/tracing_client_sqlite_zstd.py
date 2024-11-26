from bench.utils import create_large_json, create_run_data
from uuid import uuid4
import time
import threading
import sqlite3
import zstandard as zstd
import io
import os
import orjson
from memory_profiler import profile

NUM_RUNS = 0
INSERT_STMT = '''
    INSERT INTO runs (run_id, dotted_order, inputs, outputs)
    VALUES (?, ?, ?, ?)
'''
NUM_THREADS = 1


def insert_run_into_db(conn, run):
    """Insert a run into the SQLite database."""
    # Convert inputs and outputs to JSON strings and then to bytes (BLOBs)
    cursor = conn.cursor()
    inputs_blob = orjson.dumps(run['inputs'])
    outputs_blob = orjson.dumps(run['outputs'])
    run_id = run['id']
    dotted_order = run['dotted_order']

    start = time.perf_counter()
    cursor.execute(INSERT_STMT, (run_id, dotted_order, inputs_blob, outputs_blob))
    conn.commit()
    end = time.perf_counter()
    # print(f"Insertion time: {end - start:.6f} seconds")


def process_batch(cursor, compressor, last_processed_dotted_order, batch_size):
    """Process a single batch of runs and return the count and last processed order."""
    start = time.perf_counter()
    # Fetch runs after our last processed order
    res = cursor.execute('''
        SELECT run_id, inputs, outputs, dotted_order
        FROM runs 
        WHERE dotted_order > ?
        ORDER BY dotted_order 
        LIMIT ?;
    ''', (last_processed_dotted_order or '', batch_size))
    print("Time taken to fetch runs: ", time.perf_counter() - start)

    # Process runs one at a time using cursor iterator
    zstd_buffer = io.BytesIO()
    run_count = 0
    last_order = last_processed_dotted_order

    start = time.perf_counter()
    with compressor.stream_writer(zstd_buffer) as compressor_stream:
        for run_id, inputs_blob, outputs_blob, dotted_order in res:
            run_count += 1
            data = inputs_blob + b'\n' + outputs_blob + b'\n'
            compressor_stream.write(data)
            last_order = dotted_order
        compressed_size = zstd_buffer.tell()

    if compressed_size > 0:
        print("Time taken to compress runs: ", time.perf_counter() - start)
        # Sleep to simulate network latency
        print("Sending compressed buffer of size: ", compressed_size)
        time.sleep(0.150)
        print(f"Processed {run_count} runs")
        global NUM_RUNS
        NUM_RUNS += run_count

    return run_count, last_order


def run_processor(db_file, stop_event):
    """Background thread function to fetch runs and process them."""
    conn = sqlite3.connect(db_file, timeout=30)
    cursor = conn.cursor()

    compressor = zstd.ZstdCompressor(level=3)
    BATCH_SIZE = 300
    last_processed_dotted_order = None

    try:
        while not stop_event.is_set():
            run_count, last_processed_dotted_order = process_batch(
                cursor,
                compressor,
                last_processed_dotted_order,
                BATCH_SIZE
            )

            # if run_count == 0:
            #     time.sleep(0.500)  # No runs found, wait before checking again
            #     continue

        # Drain remaining runs
        print("Stop event set, draining remaining runs...")
        while True:
            run_count, last_processed_dotted_order = process_batch(
                cursor,
                compressor,
                last_processed_dotted_order,
                BATCH_SIZE
            )
            if run_count == 0:
                print("Draining complete")
                break

    finally:
        conn.close()

@profile
def benchmark_run_creation(json_size, num_runs) -> None:
    """Benchmark the creation of runs."""
    # delete the existing database file
    if os.path.exists('runs.db'):
        os.remove('runs.db')

    db_file = 'runs.db'
    # Initialize SQLite database
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute('PRAGMA journal_mode=WAL;')
    cursor.execute('PRAGMA synchronous=OFF')
    cursor.execute('PRAGMA journal_mode=MEMORY')
    # Create table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS runs (
            run_id TEXT PRIMARY KEY,
            dotted_order TEXT,
            inputs BLOB,
            outputs BLOB
        );
    ''')

    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_status_dotted_order 
        ON runs(dotted_order);
    ''')
    conn.commit()

    print("Creating runs...")
    inputs, outputs = create_large_json(json_size), create_large_json(json_size)
    runs = [create_run_data(str(uuid4()), inputs, outputs) for _ in range(num_runs)]
    print("Runs created.")

    stop_event = threading.Event()
    processor_threads = []
    for _ in range(NUM_THREADS):
        processor_thread = threading.Thread(target=run_processor, args=(db_file, stop_event))
        processor_thread.start()
        processor_threads.append(processor_thread)

    start = time.perf_counter()

    for run in runs:
        insert_run_into_db(conn, run)

    # Close the main thread's database connection
    conn.close()

    # Signal the processor thread to stop
    stop_event.set()

    # Join the processor threads
    for processor_thread in processor_threads:
        processor_thread.join()

    print("Time taken to insert runs: ", time.perf_counter() - start)
    print("Total runs processed: ", NUM_RUNS)


def main():
    """Run benchmarks with specified parameters."""
    json_size = 5_000
    num_runs = 2_000

    benchmark_run_creation(json_size, num_runs)


if __name__ == "__main__":
    main()
