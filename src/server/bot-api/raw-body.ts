export const MAX_BOT_API_BODY_BYTES = 64 * 1024;
const BOT_API_BODY_READ_TIMEOUT_MS = 5_000;

export type RawBodyErrorCode =
  | "unsupported_method"
  | "unsupported_content_type"
  | "payload_too_large"
  | "request_timeout"
  | "body_read_failed";

export class RawBodyError extends Error {
  readonly code: RawBodyErrorCode;

  constructor(code: RawBodyErrorCode) {
    super(code);
    this.name = "RawBodyError";
    this.code = code;
  }
}

function contentTypeIsJson(request: Request): boolean {
  const contentType = request.headers.get("content-type");
  if (!contentType) return false;
  return contentType.split(";", 1)[0].trim().toLowerCase() === "application/json";
}

function declaredLength(request: Request): number | null {
  const value = request.headers.get("content-length");
  if (value === null) return null;
  if (!/^\d+$/.test(value.trim())) throw new RawBodyError("body_read_failed");
  const length = Number(value);
  if (!Number.isSafeInteger(length)) throw new RawBodyError("body_read_failed");
  return length;
}

export async function readBoundedRawBody(request: Request, options: { timeoutMs?: number } = {}): Promise<Uint8Array> {
  if (request.method !== "POST") throw new RawBodyError("unsupported_method");
  if (!contentTypeIsJson(request)) throw new RawBodyError("unsupported_content_type");

  const length = declaredLength(request);
  if (length !== null && length > MAX_BOT_API_BODY_BYTES) {
    throw new RawBodyError("payload_too_large");
  }

  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const timeoutMs = options.timeoutMs ?? BOT_API_BODY_READ_TIMEOUT_MS;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new RawBodyError("request_timeout")), timeoutMs);
    });

    while (true) {
      const result = await Promise.race([reader.read(), timeoutPromise]);
      if (result.done) break;
      total += result.value.byteLength;
      if (total > MAX_BOT_API_BODY_BYTES) throw new RawBodyError("payload_too_large");
      chunks.push(result.value);
    }
  } catch (error) {
    try {
      void reader.cancel().catch(() => undefined);
    } catch {
      // Cancellation is best effort; the read timeout remains authoritative.
    }
    if (error instanceof RawBodyError) throw error;
    throw new RawBodyError("body_read_failed");
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }

  const body = new Uint8Array(total);
  chunks.reduce((offset, chunk) => {
    body.set(chunk, offset);
    return offset + chunk.byteLength;
  }, 0);
  return body;
}
