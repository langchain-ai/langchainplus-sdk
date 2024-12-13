use serde::{Deserialize, Serialize};
use serde_json::Value;

// Map attachment ref to tuple of filename, optional bytes
#[derive(Debug, Serialize, Deserialize)]
pub struct Attachment {
    pub ref_name: String,
    pub filename: String,
    pub data: Option<Vec<u8>>,
    pub content_type: String,
}

// Must support both string (Py) and unsigned int (JS)
#[derive(Serialize, Deserialize, PartialEq, Debug)]
#[serde(untagged)]
pub enum TimeValue {
    String(String),
    UnsignedInt(u64),
}

#[derive(PartialEq, Debug, Serialize, Deserialize)]
pub struct RunIO {
    pub inputs: Option<Vec<u8>>,
    pub outputs: Option<Vec<u8>>,
}

impl RunIO {
    #[inline]
    pub(crate) fn merge(&mut self, other: RunIO) {
        if other.inputs.is_some() {
            self.inputs = other.inputs;
        }
        if other.outputs.is_some() {
            self.outputs = other.outputs;
        }
    }
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct RunCommon {
    pub id: String,
    pub trace_id: String,
    pub dotted_order: String,
    pub parent_run_id: Option<String>,
    pub extra: Option<Value>,
    pub error: Option<String>,
    pub serialized: Option<Value>,
    pub events: Option<Value>,
    pub tags: Option<Value>,
    pub session_id: Option<String>,
    pub session_name: Option<String>,
}

impl RunCommon {
    #[inline]
    pub(crate) fn merge(&mut self, other: RunCommon) {
        if other.parent_run_id.is_some() {
            self.parent_run_id = other.parent_run_id;
        }
        if other.extra.is_some() {
            self.extra = other.extra;
        }
        if other.error.is_some() {
            self.error = other.error;
        }
        if other.serialized.is_some() {
            self.serialized = other.serialized;
        }
        if other.events.is_some() {
            self.events = other.events;
        }
        if other.tags.is_some() {
            self.tags = other.tags;
        }
        if other.session_id.is_some() {
            self.session_id = other.session_id;
        }
        if other.session_name.is_some() {
            self.session_name = other.session_name;
        }
    }
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct RunCreate {
    #[serde(flatten)]
    pub common: RunCommon,
    pub name: String,
    pub start_time: TimeValue,
    pub end_time: Option<TimeValue>,
    pub run_type: String,
    pub reference_example_id: Option<String>,
}

#[derive(Serialize, Deserialize, PartialEq, Debug)]
pub struct RunUpdate {
    #[serde(flatten)]
    pub common: RunCommon,
    pub end_time: TimeValue,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RunCreateExtended {
    pub run_create: RunCreate,
    pub io: RunIO,
    pub attachments: Option<Vec<Attachment>>,
}

#[derive(Debug)]
pub struct RunUpdateExtended {
    pub run_update: RunUpdate,
    pub io: RunIO,
    pub attachments: Option<Vec<Attachment>>,
}

#[derive(Debug)]
pub struct RunEventBytes {
    pub run_id: String,
    pub event_type: EventType,
    pub run_bytes: Vec<u8>,
    pub inputs_bytes: Option<Vec<u8>>,
    pub outputs_bytes: Option<Vec<u8>>,
    pub attachments: Option<Vec<Attachment>>,
}

#[derive(Debug)]
pub enum EventType {
    Create,
    Update,
}

#[derive(Debug)]
pub(crate) enum QueuedRun {
    Create(RunCreateExtended),
    Update(RunUpdateExtended),
    #[expect(dead_code)]
    RunBytes(RunEventBytes),
    Drain, // Like `Shutdown`, but explicitly sends a message confirming draining is complete.
    Shutdown,
}
