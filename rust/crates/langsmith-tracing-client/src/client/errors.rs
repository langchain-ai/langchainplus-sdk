use thiserror::Error;

#[derive(Error, Debug)]
pub enum TracingClientError {
    #[error("Queue is full")]
    QueueFull,

    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),

    #[error("HTTP error: status {0}, message \"{1}\"")]
    HttpError(reqwest::StatusCode, String),

    #[error("Request error: {0}")]
    RequestError(#[from] reqwest::Error),

    #[error("Unexpected shutdown")]
    UnexpectedShutdown,

    #[error("IO error")]
    IoError(String),
}

impl From<std::io::Error> for TracingClientError {
    fn from(value: std::io::Error) -> Self {
        Self::IoError(value.to_string())
    }
}

/// When an error involving our output stream happens, what state is the stream in?
#[derive(Debug)]
pub(crate) enum StreamState {
    /// The stream is safe. We can skip the offending record and keep going.
    #[expect(
        dead_code,
        reason = "will be used when we decide how to report non-fatal client errors"
    )]
    Safe(TracingClientError),

    /// Some of the offending record's data has been written into the stream,
    /// so the stream's data is now invalid and cannot be recovered.
    /// We must discard the entire stream and start over.
    #[expect(
        dead_code,
        reason = "will be used when we decide how to report non-fatal client errors"
    )]
    Polluted(TracingClientError),
}

impl StreamState {
    pub(crate) fn safe(inner: impl Into<TracingClientError>) -> Self {
        Self::Safe(inner.into())
    }

    pub(crate) fn polluted(inner: impl Into<TracingClientError>) -> Self {
        Self::Polluted(inner.into())
    }
}
