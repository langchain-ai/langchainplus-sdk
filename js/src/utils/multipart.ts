import { AttachmentData, RunCreate, RunUpdate } from "../schemas.js";
import { stringify as stringifyForTracing } from "./fast-safe-stringify/index.js";

export const MULTIPART_BOUNDARY =
  "----LangSmithFormBoundary" + Math.random().toString(36).slice(2);

export type MultipartPart = {
  name: string;
  payload: Blob;
};

export function serializeRunOperationAsMultipart(
  method: string,
  originalPayload: RunCreate | RunUpdate
) {
  const accumulatedParts: MultipartPart[] = [];
  const accumulatedContext: string[] = [];
  // collect fields to be sent as separate parts
  const { inputs, outputs, events, attachments, ...payload } = originalPayload;
  const fields = { inputs, outputs, events };
  // encode the main run payload
  const stringifiedPayload = stringifyForTracing(payload);
  accumulatedParts.push({
    name: `${method}.${payload.id}`,
    payload: new Blob([stringifiedPayload], {
      type: `application/json; length=${stringifiedPayload.length}`,
    }),
  });
  // encode the fields we collected
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }
    const stringifiedValue = stringifyForTracing(value);
    accumulatedParts.push({
      name: `${method}.${payload.id}.${key}`,
      payload: new Blob([stringifiedValue], {
        type: `application/json; length=${stringifiedValue.length}`,
      }),
    });
  }
  // encode the attachments
  if (payload.id !== undefined) {
    if (attachments) {
      for (const [name, attachment] of Object.entries(attachments)) {
        let contentType: string;
        let content: AttachmentData;

        if (Array.isArray(attachment)) {
          [contentType, content] = attachment;
        } else {
          contentType = attachment.mimeType;
          content = attachment.data;
        }

        // Validate that the attachment name doesn't contain a '.'
        if (name.includes(".")) {
          console.warn(
            `Skipping attachment '${name}' for run ${payload.id}: Invalid attachment name. ` +
              `Attachment names must not contain periods ('.'). Please rename the attachment and try again.`
          );
          continue;
        }
        accumulatedParts.push({
          name: `attachment.${payload.id}.${name}`,
          payload: new Blob([content], {
            type: `${contentType}; length=${content.byteLength}`,
          }),
        });
      }
    }
  }
  // compute context
  accumulatedContext.push(`trace=${payload.trace_id},id=${payload.id}`);
  return {
    parts: accumulatedParts,
    context: accumulatedContext,
  };
}

export function convertToMultipartBlobChunks(parts: MultipartPart[]) {
  // Create multipart form data manually using Blobs
  const chunks: Blob[] = [];

  for (const part of parts) {
    // Add field boundary
    chunks.push(new Blob([`--${MULTIPART_BOUNDARY}\r\n`]));
    chunks.push(
      new Blob([
        `Content-Disposition: form-data; name="${part.name}"\r\n`,
        `Content-Type: ${part.payload.type}\r\n\r\n`,
      ])
    );
    chunks.push(part.payload);
    chunks.push(new Blob(["\r\n"]));
  }

  // Do once at the end?
  // // Add final boundary
  // chunks.push(new Blob([`--${MULTIPART_BOUNDARY}--\r\n`]));

  return chunks;
}
