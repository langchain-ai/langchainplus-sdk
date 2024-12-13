use napi::{bindgen_prelude::FromNapiValue, Env, JsUnknown, NapiValue};

#[derive(Debug, serde::Deserialize)]
#[serde(transparent)]
pub struct RunCreateExtended(langsmith_tracing_client::client::RunCreateExtended);

impl RunCreateExtended {
    #[inline]
    pub(crate) fn into_inner(self) -> langsmith_tracing_client::client::RunCreateExtended {
        self.0
    }
}

impl FromNapiValue for RunCreateExtended {
    unsafe fn from_napi_value(
        napi_env: napi::sys::napi_env,
        napi_val: napi::sys::napi_value,
    ) -> napi::Result<Self> {
        let env = Env::from_raw(napi_env);
        let value = JsUnknown::from_raw(napi_env, napi_val)?;
        env.from_js_value(value)
    }
}
