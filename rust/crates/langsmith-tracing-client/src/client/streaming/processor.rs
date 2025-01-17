use std::{
    path::Path,
    sync::Arc,
    time::{Duration, Instant},
};

use backon::BlockingRetryable as _;

use crate::client::{
    errors::StreamState, run::QueuedRun, RunCreate, RunCreateExtended, RunUpdate,
    RunUpdateExtended, TracingClientError,
};

use super::{multipart_writer::StreamingMultipart, ClientConfig};

trait ErrorReporter {
    fn report_run_create_processing_error(
        &self,
        operation: &RunCreate,
        part_name: &str,
        stream_state: &StreamState,
    ) {
        eprintln!("run create processing error: {operation:?} {part_name} {stream_state:?}")
    }

    fn report_run_update_processing_error(
        &self,
        operation: &RunUpdate,
        part_name: &str,
        stream_state: &StreamState,
    ) {
        eprintln!("run update processing error: {operation:?} {part_name} {stream_state:?}")
    }

    fn report_transmit_retry(&self, e: &TracingClientError, retry_after: Duration) {
        eprintln!("transmit error {e}, retrying in {}ms", retry_after.as_millis())
    }

    fn report_final_transmit_error(&self, e: TracingClientError) {
        eprintln!("giving up due to error {e}")
    }
}

/// Print each reported error to stderr.
struct EprintlnReporter;

impl ErrorReporter for EprintlnReporter {}

pub struct RunProcessor {
    receiver: crossbeam_channel::Receiver<QueuedRun>,
    drain_sender: crossbeam_channel::Sender<()>,
    http_client: reqwest::blocking::Client,
    config: Arc<ClientConfig>,
    compression_workers: u32,
    multipart_stream: StreamingMultipart<zstd::stream::write::Encoder<'static, Vec<u8>>>,
    error_reporter: Box<dyn ErrorReporter>,
}

impl RunProcessor {
    fn make_stream(
        compression_level: i32,
        n_workers: u32,
    ) -> StreamingMultipart<zstd::stream::write::Encoder<'static, Vec<u8>>> {
        // Unfortunately, the `reqwest` API doesn't seem to allow reusing this buffer
        // since `Into<Body>` requires `&'static [u8]` and can't take an arbitrary lifetime.
        let buffer = Vec::with_capacity(8192);

        let mut compressor = zstd::stream::write::Encoder::new(buffer, compression_level)
            .expect("failed to construct compressor");
        compressor.multithread(n_workers).expect("failed to enable multithreading in compressor");

        StreamingMultipart::new(compressor)
    }

    pub(crate) fn new(
        receiver: crossbeam_channel::Receiver<QueuedRun>,
        drain_sender: crossbeam_channel::Sender<()>,
        config: Arc<ClientConfig>,
    ) -> Self {
        let http_client = reqwest::blocking::Client::new();

        // We want to use as many threads as available cores to compress data.
        // However, we have to be mindful of special values in the zstd library:
        // - A setting of `0` here means "use the current thread only."
        // - A setting of `1` means "use a separate thread, but only one."
        //
        // `1` isn't a useful setting for us, so turn `1` into `0` while
        // keeping higher numbers the same.
        let compression_workers = match std::thread::available_parallelism() {
            Ok(num) => {
                if num.get() == 1 {
                    0
                } else {
                    num.get() as u32
                }
            }
            Err(_) => {
                // We failed to query the available number of cores.
                // Use only the current single thread, to be safe.
                0
            }
        };

        let multipart_stream = Self::make_stream(config.compression_level, compression_workers);
        let error_reporter = Box::new(EprintlnReporter);

        Self {
            receiver,
            drain_sender,
            http_client,
            config,
            compression_workers,
            multipart_stream,
            error_reporter,
        }
    }

    pub(crate) fn run(&mut self) {
        let mut last_send_time = Instant::now();

        loop {
            let queued_run = { self.receiver.recv_timeout(Duration::from_millis(100)) };

            match queued_run {
                Ok(queued_run) => match queued_run {
                    QueuedRun::Shutdown => {
                        self.send_pending_data();
                        break;
                    }
                    QueuedRun::Drain => {
                        self.send_pending_data();
                        self.drain_sender.send(()).expect("drain_sender should never fail");
                        break;
                    }
                    _ => {
                        match self.process_new_data(queued_run) {
                            Ok(()) => {
                                // The new data was added to the stream.
                                if self.multipart_stream.get_ref().get_ref().len()
                                    >= self.config.send_at_batch_size
                                {
                                    self.send_pending_data();
                                    last_send_time = Instant::now();
                                }
                            }
                            Err(StreamState::Safe(..)) => {
                                // Failed to process the new run data, but the prior data is safe.
                                // We're dropping this run data item and moving on.
                            }
                            Err(StreamState::Polluted(..)) => {
                                // The stream is polluted. We have to discard its data
                                // and start a new stream.
                                self.multipart_stream = Self::make_stream(
                                    self.config.compression_level,
                                    self.compression_workers,
                                );
                            }
                        }
                    }
                },
                Err(crossbeam_channel::RecvTimeoutError::Timeout) => {
                    if self.multipart_stream.is_empty()
                        && last_send_time.elapsed() >= self.config.send_at_batch_time
                    {
                        self.send_pending_data();
                        last_send_time = Instant::now();
                    }
                }
                Err(crossbeam_channel::RecvTimeoutError::Disconnected) => {
                    // The sending part of the channel was dropped, so no further data is incoming.
                    self.send_pending_data();
                    break;
                }
            }
        }
    }

    /// Send any data that is present in the compressed stream, retrying errors.
    ///
    /// If retries are exhausted without success, report the error to the error reporter
    /// and drop the data.
    fn send_pending_data(&mut self) {
        if self.multipart_stream.is_empty() {
            return;
        }

        let outcome = self.prepare_request().and_then(|request| self.submit_request(request));
        if let Err(e) = outcome {
            self.error_reporter.report_final_transmit_error(e);
        }
    }

    fn prepare_request(&mut self) -> Result<reqwest::blocking::RequestBuilder, TracingClientError> {
        // Start a new compression stream for future payload data, and replace the current one.
        let next_stream =
            Self::make_stream(self.config.compression_level, self.compression_workers);
        let compressed_stream = std::mem::replace(&mut self.multipart_stream, next_stream);

        let content_type =
            format!("multipart/form-data; boundary={}", compressed_stream.boundary());
        let compressed_payload = compressed_stream.finish()?.finish()?;

        let request = self
            .http_client
            .post(format!("{}/runs/multipart", self.config.endpoint))
            .headers(self.config.headers.as_ref().cloned().unwrap_or_default())
            .header(http::header::CONTENT_TYPE, content_type)
            .header(http::header::CONTENT_ENCODING, "zstd")
            .body(compressed_payload);

        Ok(request)
    }

    /// Attempt to submit the prepared request, retrying errors.
    fn submit_request(
        &mut self,
        request: reqwest::blocking::RequestBuilder,
    ) -> Result<(), TracingClientError> {
        let sender = move || -> Result<(), TracingClientError> {
            // We have to clone the request before sending it, so we can retry it.
            // Requests are designed to be cheaply cloneable.
            // Cloning a request *does not* clone the buffer that represents the body.
            let cloned_request = request.try_clone().expect("request was not cloneable, please make sure the body is a `Vec<u8>` buffer and not a stream");

            let response = cloned_request.send()?;
            if response.status().is_success() {
                Ok(())
            } else {
                let status = response.status();
                let message = response.text().unwrap_or_default();
                Err(TracingClientError::HttpError(status, message))
            }
        };

        sender
            .retry(
                // Approximate a Fibonacci backoff with jitter.
                // In an ideal world, we'd have the option of full jitter
                // (from 0 to the current exponential amount) since that performs a bit better.
                // But `backon` doesn't seem to offer that option, and the improvement is marginal
                // so it isn't worth implementing.
                //
                // More info:
                // https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
                backon::ExponentialBuilder::default()
                    .with_factor(1.6)
                    .with_min_delay(Duration::from_millis(500))
                    .with_max_delay(Duration::from_secs(8))
                    .with_jitter()
                    .with_max_times(4), // 1 initial attempt + 4 retries = 5 attempts total
            )
            .sleep(std::thread::sleep)
            .when(move |e| {
                match e {
                    TracingClientError::HttpError(status_code, _) => {
                        if status_code.as_u16() == http::StatusCode::TOO_MANY_REQUESTS.as_u16() {
                            // The server is telling us to slow down our request rate.
                            // Ensure we sleep for an extra second before continuing.
                            std::thread::sleep(Duration::from_secs(1));
                            true
                        } else {
                            // Retry server errors (status 5xx).
                            status_code.is_server_error()
                        }
                    }
                    TracingClientError::RequestError(error) => {
                        // Retry network-related errors like connection failures and timeouts.
                        error.is_connect() || error.is_timeout()
                    }
                    _ => false,
                }
            })
            .notify(|err, dur| {
                self.error_reporter.report_transmit_retry(err, dur);
            })
            .call()
    }

    /// Serialize the run data into the output stream.
    ///
    /// If errors are encountered, attempt to recover as best as possible:
    /// - If partial run data can be sent intact, attempt to do so. For example,
    ///   if a specified attachment file cannot be found, drop that attachment and submit the rest.
    ///   In such a case, the function returns `Ok(())` and reports the error via `error_reporter`.
    /// - If the run data cannot be sent at all, skip the run but attempt to keep the stream intact
    ///   as it contains data on other run events which we still want to transmit.
    ///   In such a case, the function returns `Err(StreamState::Safe(..))`.
    /// - If the stream may have been corrupted, returns `Err(StreamState::Polluted(..))`.
    ///   The caller must discard all data in the stream and start a new stream.
    fn process_new_data(&mut self, queued_run: QueuedRun) -> Result<(), StreamState> {
        match queued_run {
            QueuedRun::Create(run_create_extended) => {
                let RunCreateExtended { run_create, io, attachments } = run_create_extended;
                let run_id = run_create.common.id.as_str();

                // Collect JSON data.
                // If we fail to serialize this basic metadata, the entire event entry is useless
                // since the server won't be able to make sense of it. Return an error immediately.
                let part_name = format!("post.{}", run_id);
                let serialized = serde_json::to_vec(&run_create)
                    .map_err(StreamState::safe)
                    .inspect_err(|e| {
                        self.error_reporter.report_run_create_processing_error(
                            &run_create,
                            &part_name,
                            e,
                        );
                    })?;
                self.multipart_stream.json_part(&part_name, &serialized).inspect_err(|e| {
                    self.error_reporter.report_run_create_processing_error(
                        &run_create,
                        &part_name,
                        e,
                    );
                })?;

                // Ensure that pre-formatted JSON data represented as bytes
                // doesn't end in trailing null bytes, since they are unnecessary
                // in HTTP multipart requests.
                //
                // If writing this data fails in a way that doesn't pollute the stream,
                // we can attempt to keep going. Report any errors
                // to the error reporter, whether or not we're suppressing them.
                if let Some(mut inputs) = io.inputs {
                    if inputs.last() == Some(&0) {
                        inputs.pop().expect("popping trailing null byte failed");
                    }

                    let part_name = format!("post.{}.inputs", run_id);

                    let outcome = self.multipart_stream.json_part(&part_name, &inputs);
                    if let Err(state) = &outcome {
                        self.error_reporter.report_run_create_processing_error(
                            &run_create,
                            &part_name,
                            state,
                        );
                        if let StreamState::Polluted(..) = state {
                            return outcome;
                        }
                    }
                }
                if let Some(mut outputs) = io.outputs {
                    if outputs.last() == Some(&0) {
                        outputs.pop().expect("popping trailing null byte failed");
                    }

                    let part_name = format!("post.{}.outputs", run_id);

                    let outcome = self.multipart_stream.json_part(&part_name, &outputs);
                    if let Err(state) = &outcome {
                        self.error_reporter.report_run_create_processing_error(
                            &run_create,
                            &part_name,
                            state,
                        );
                        if let StreamState::Polluted(..) = state {
                            return outcome;
                        }
                    }
                }

                // If including any attachment fails in such a way that the stream is not polluted,
                // simply drop it from the payload and keep going. Report any errors
                // to the error reporter, whether or not we're suppressing them.
                if let Some(attachments) = attachments {
                    for attachment in attachments {
                        let part_name = format!("attachment.{}.{}", run_id, attachment.ref_name);
                        let outcome = if let Some(data) = attachment.data {
                            self.multipart_stream.file_part_from_bytes(
                                &part_name,
                                &attachment.ref_name,
                                &attachment.content_type,
                                &data,
                            )
                        } else {
                            self.multipart_stream.file_part_from_path(
                                &part_name,
                                &attachment.ref_name,
                                &attachment.content_type,
                                Path::new(&attachment.filename),
                            )
                        };

                        if let Err(state) = &outcome {
                            self.error_reporter.report_run_create_processing_error(
                                &run_create,
                                &part_name,
                                state,
                            );
                            if let StreamState::Polluted(..) = state {
                                return outcome;
                            }
                        }
                    }
                }

                Ok(())
            }
            QueuedRun::Update(run_update_extended) => {
                let RunUpdateExtended { run_update, io, attachments } = run_update_extended;
                let run_id = run_update.common.id.as_str();

                // Collect JSON data.
                // If we fail to serialize this basic metadata, the entire event entry is useless
                // since the server won't be able to make sense of it. Return an error immediately.
                let part_name = format!("patch.{}", run_id);
                let serialized = serde_json::to_vec(&run_update)
                    .map_err(StreamState::safe)
                    .inspect_err(|e| {
                        self.error_reporter.report_run_update_processing_error(
                            &run_update,
                            &part_name,
                            e,
                        );
                    })?;
                self.multipart_stream.json_part(&part_name, &serialized).inspect_err(|e| {
                    self.error_reporter.report_run_update_processing_error(
                        &run_update,
                        &part_name,
                        e,
                    );
                })?;

                // Ensure that pre-formatted JSON data represented as bytes
                // doesn't end in trailing null bytes, since they are unnecessary
                // in HTTP multipart requests.
                //
                // If writing this data fails in a way that doesn't pollute the stream,
                // we can attempt to keep going. Report any errors
                // to the error reporter, whether or not we're suppressing them.
                if let Some(mut outputs) = io.outputs {
                    if outputs.last() == Some(&0) {
                        outputs.pop().expect("popping trailing null byte failed");
                    }

                    let part_name = format!("patch.{}.outputs", run_id);

                    let outcome = self.multipart_stream.json_part(&part_name, &outputs);
                    if let Err(state) = &outcome {
                        self.error_reporter.report_run_update_processing_error(
                            &run_update,
                            &part_name,
                            state,
                        );
                        if let StreamState::Polluted(..) = state {
                            return outcome;
                        }
                    }
                }

                // If including any attachment fails in such a way that the stream is not polluted,
                // simply drop it from the payload and keep going. Report any errors
                // to the error reporter, whether or not we're suppressing them.
                if let Some(attachments) = attachments {
                    for attachment in attachments {
                        let part_name = format!("attachment.{}.{}", run_id, attachment.ref_name);
                        let outcome = if let Some(data) = attachment.data {
                            self.multipart_stream.file_part_from_bytes(
                                &part_name,
                                &attachment.ref_name,
                                &attachment.content_type,
                                &data,
                            )
                        } else {
                            self.multipart_stream.file_part_from_path(
                                &part_name,
                                &attachment.ref_name,
                                &attachment.content_type,
                                Path::new(&attachment.filename),
                            )
                        };

                        if let Err(state) = &outcome {
                            self.error_reporter.report_run_update_processing_error(
                                &run_update,
                                &part_name,
                                state,
                            );
                            if let StreamState::Polluted(..) = state {
                                return outcome;
                            }
                        }
                    }
                }

                Ok(())
            }
            QueuedRun::Drain | QueuedRun::Shutdown => {
                unreachable!("drain/shutdown message that wasn't handled earlier");
            }
        }
    }
}
