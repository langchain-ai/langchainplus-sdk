use std::time::Duration;

use napi_derive::napi;

use langsmith_tracing_client::client::blocking::TracingClient as RustTracingClient;

mod types;

#[napi]
pub struct TracingClient {
    client: RustTracingClient,
}

#[napi]
impl TracingClient {
    #[napi(constructor)]
    pub fn new(
        endpoint: String,
        api_key: String,
        queue_capacity: u32,
        batch_size: u32,
        batch_timeout_millis: u32,
        worker_threads: u32,
    ) -> napi::Result<Self> {
        let config = langsmith_tracing_client::client::blocking::ClientConfig {
            endpoint,
            api_key,
            queue_capacity: queue_capacity as usize,
            batch_size: batch_size as usize,

            // TODO: check if this is fine
            batch_timeout: Duration::from_millis(batch_timeout_millis as u64),

            headers: None, // TODO: support custom headers
            num_worker_threads: worker_threads as usize,
        };

        let client =
            RustTracingClient::new(config).map_err(|e| napi::Error::from_reason(format!("{e}")))?;

        Ok(Self { client })
    }

    #[napi]
    pub fn create_run(&self, run: types::RunCreateExtended) -> napi::Result<()> {
        // TODO: this is for debugging only, remove it before publishing
        println!("Rust bindings received run: {run:?}");

        self.client.submit_run_create(run.into_inner()).map_err(|e| {
            // TODO: this is for debugging only, remove it before publishing
            println!("Submitting run failed with error: {e:?}");

            napi::Error::from_reason(format!("{e}"))
        })
    }
}
