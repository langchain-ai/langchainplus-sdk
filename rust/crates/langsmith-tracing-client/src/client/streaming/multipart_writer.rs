use std::{borrow::Cow, io::Write, path::Path};

use crate::client::errors::StreamState;

pub struct StreamingMultipart<W: Write> {
    writer: W,
    boundary: String,
    empty: bool,
}

impl<W: Write> StreamingMultipart<W> {
    pub(super) fn new(writer: W) -> Self {
        let boundary = generate_boundary();
        Self { writer, boundary, empty: true }
    }

    #[inline(always)]
    pub(super) fn get_ref(&self) -> &W {
        &self.writer
    }

    #[inline(always)]
    pub(super) fn is_empty(&self) -> bool {
        self.empty
    }

    #[inline(always)]
    pub(super) fn boundary(&self) -> &str {
        &self.boundary
    }

    /// Implement field value escaping as specified in the HTTP5 standard:
    /// <https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#multipart-form-data>
    ///
    /// > - Field names, field values for non-file fields, and filenames for file fields,
    /// >   in the generated multipart/form-data resource must be set to the result of encoding
    /// >   the corresponding entry's name or value with encoding, converted to a byte sequence.
    /// >
    /// > - For field names and filenames for file fields, the result of the encoding in the
    /// >   previous bullet point must be escaped by replacing any 0x0A (LF) bytes with
    /// >   the byte sequence `%0A`, 0x0D (CR) with `%0D` and 0x22 (") with `%22`.
    /// >   The user agent must not perform any other escapes.
    fn escape_field_value(value: &str) -> Cow<'_, str> {
        if value.contains(['"', '\n', '\r']) {
            value.replace('"', "%22").replace('\n', "%0A").replace('\r', "%0D").into()
        } else {
            Cow::Borrowed(value)
        }
    }

    pub(super) fn json_part(&mut self, name: &str, serialized: &[u8]) -> Result<(), StreamState> {
        self.empty = false;
        let boundary = self.boundary.as_str();
        let length = serialized.len();
        let name = Self::escape_field_value(name);

        // The HTTP5 standard prohibits the `Content-Type` header on multipart form parts
        // that do not correspond to a file upload:
        //   https://html.spec.whatwg.org/multipage/form-control-infrastructure.html#multipart-form-data
        //
        // However, the current server-side implementation *requires* this header,
        // so we add it anyway.
        //
        // `Content-Length` is explicitly prohibited in multipart parts by RFC 7578:
        //   https://datatracker.ietf.org/doc/html/rfc7578#section-4.8
        //
        // However, the server-side implementation *requires* that the length is specified,
        // so we add it anyway.
        write!(
            self.writer,
            "--{boundary}\r\n\
Content-Disposition: form-data; name=\"{name}\"\r\n\
Content-Type: application/json\r\n\
Content-Length: {length}\r\n\
\r\n"
        )
        .map_err(StreamState::polluted)?;

        self.writer.write_all(serialized).map_err(StreamState::polluted)?;
        write!(self.writer, "\r\n").map_err(StreamState::polluted)
    }

    pub(super) fn file_part_from_bytes(
        &mut self,
        name: &str,
        file_name: &str,
        content_type: &str,
        contents: &[u8],
    ) -> Result<(), StreamState> {
        self.empty = false;
        let boundary = self.boundary.as_str();
        let length = contents.len();
        let name = Self::escape_field_value(name);
        let file_name = Self::escape_field_value(file_name);

        // `Content-Length` is explicitly prohibited in multipart parts by RFC 7578:
        //   https://datatracker.ietf.org/doc/html/rfc7578#section-4.8
        //
        // However, the server-side implementation *requires* that the length is specified,
        // so we add it anyway.
        write!(
            self.writer,
            "--{boundary}\r\n\
Content-Disposition: form-data; name=\"{name}\"; filename=\"{file_name}\"\r\n\
Content-Type: {content_type}\r\n\
Content-Length: {length}\r\n\
\r\n"
        )
        .map_err(StreamState::polluted)?;

        self.writer.write_all(contents).map_err(StreamState::polluted)?;

        write!(self.writer, "\r\n").map_err(StreamState::polluted)
    }

    pub(super) fn file_part_from_path(
        &mut self,
        name: &str,
        file_name: &str,
        content_type: &str,
        path: &Path,
    ) -> Result<(), StreamState> {
        self.empty = false;
        let boundary = self.boundary.as_str();
        let name = Self::escape_field_value(name);
        let file_name = Self::escape_field_value(file_name);

        let mut file = std::fs::File::open(path).map_err(StreamState::safe)?;
        let metadata = file.metadata().map_err(StreamState::safe)?;
        let file_size = metadata.len();

        // `Content-Length` is explicitly prohibited in multipart parts by RFC 7578:
        //   https://datatracker.ietf.org/doc/html/rfc7578#section-4.8
        //
        // However, the server-side implementation *requires* that the length is specified,
        // so we add it anyway.
        write!(
            self.writer,
            "--{boundary}\r\n\
Content-Disposition: form-data; name=\"{name}\"; filename=\"{file_name}\"\r\n\
Content-Type: {content_type}\r\n\
Content-Length: {file_size}\r\n\
\r\n"
        )
        .map_err(StreamState::polluted)?;

        std::io::copy(&mut file, &mut self.writer).map_err(StreamState::polluted)?;

        write!(self.writer, "\r\n").map_err(StreamState::polluted)
    }

    pub(super) fn finish(mut self) -> Result<W, std::io::Error> {
        let boundary = self.boundary.as_str();
        write!(&mut self.writer, "--{boundary}--\r\n")?;
        Ok(self.writer)
    }
}

fn generate_boundary() -> String {
    let chars: [char; 16] = std::array::from_fn(|_| fastrand::alphanumeric());
    let mut boundary = String::with_capacity(16);
    boundary.extend(chars);
    boundary
}
