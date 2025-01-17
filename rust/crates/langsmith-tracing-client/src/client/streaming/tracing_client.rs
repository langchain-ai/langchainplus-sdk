use std::{sync::Arc, thread, time::Duration};

use reqwest::header::{HeaderMap, HeaderValue};

use crate::client::{run::QueuedRun, RunCreateExtended, RunUpdateExtended, TracingClientError};

#[derive(Clone)]
pub struct ClientConfig {
    pub endpoint: String,
    pub api_key: String,
    pub queue_capacity: usize,
    pub send_at_batch_size: usize,
    pub send_at_batch_time: Duration,
    pub headers: Option<HeaderMap>,
    pub compression_level: i32,
}

pub struct TracingClient {
    sender: crossbeam_channel::Sender<QueuedRun>,
    drain: crossbeam_channel::Receiver<()>,
    worker: thread::JoinHandle<()>,
}

impl TracingClient {
    pub fn new(mut config: ClientConfig) -> Result<Self, TracingClientError> {
        let (sender, receiver) = crossbeam_channel::bounded(config.queue_capacity);
        let (drain_sender, drain_receiver) = crossbeam_channel::bounded(0);

        // Ensure our headers include the API key,
        // and it's marked as "sensitive" so it doesn't get printed in logs.
        let mut api_key_header =
            HeaderValue::from_str(&config.api_key).expect("failed to convert API key into header");
        api_key_header.set_sensitive(true);
        config.headers.get_or_insert_with(Default::default).append("X-API-KEY", api_key_header);

        // We're going to share the config across threads.
        // It's immutable from this point onward, so Arc it for efficiency.
        let config = Arc::from(config);

        let worker = thread::spawn(move || {
            let mut processor = super::RunProcessor::new(receiver, drain_sender, config);
            processor.run();
        });

        Ok(Self { sender, drain: drain_receiver, worker })
    }

    pub fn submit_run_create(&self, run: RunCreateExtended) -> Result<(), TracingClientError> {
        let queued_run = QueuedRun::Create(run);

        self.sender.send(queued_run).map_err(|_| TracingClientError::QueueFull)
    }

    pub fn submit_run_update(&self, run: RunUpdateExtended) -> Result<(), TracingClientError> {
        let queued_run = QueuedRun::Update(run);

        self.sender.send(queued_run).map_err(|_| TracingClientError::QueueFull)
    }

    /// Complete all in-progress requests, then allow the worker threads to exit.
    ///
    /// Convenience function for the PyO3 bindings, which cannot use [`Self::shutdown`]
    /// due to its by-value `self`. This means we cannot `.join()` the threads,
    /// but the client is nevertheless unusable after this call.
    ///
    /// Sending further data after a [`Self::drain()`] call has unspecified behavior.
    /// It will not cause *undefined behavior* in the programming language sense,
    /// but it may e.g. cause errors, panics, or even silently fail, with no guarantees.
    pub fn drain(&self) -> Result<(), TracingClientError> {
        self.sender.send(QueuedRun::Drain).map_err(|_| TracingClientError::QueueFull)?;
        self.drain.recv().expect("failed to receive drained message");

        Ok(())
    }

    pub fn shutdown(self) -> Result<(), TracingClientError> {
        // Send a Shutdown message to worker thread
        self.sender.send(QueuedRun::Shutdown).map_err(|_| TracingClientError::QueueFull)?;

        // Wait for worker thread to finish
        self.worker.join().unwrap();

        Ok(())
    }
}
