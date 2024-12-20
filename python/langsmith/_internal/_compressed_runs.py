import io
import threading

try:
    from zstandard import ZstdCompressor

    HAVE_ZSTD = True
except ImportError:
    HAVE_ZSTD = False


class CompressedRuns:
    def __init__(self):
        self.buffer = io.BytesIO()
        self.run_count = 0
        self.lock = threading.Lock()
        if not HAVE_ZSTD:
            raise ImportError(
                "zstandard package required for compression. "
                "Install with 'pip install langsmith[compression]'"
            )
        self.compressor_writer = ZstdCompressor(level=3, threads=-1).stream_writer(
            self.buffer, closefd=False
        )

    def reset(self):
        self.buffer = io.BytesIO()
        self.run_count = 0
        if not HAVE_ZSTD:
            raise ImportError(
                "zstandard package required for compression. "
                "Install with 'pip install langsmith[compression]'"
            )
        self.compressor_writer = ZstdCompressor(level=3, threads=-1).stream_writer(
            self.buffer, closefd=False
        )
