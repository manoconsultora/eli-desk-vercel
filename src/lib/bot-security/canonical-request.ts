import { BotSecurityError } from "../../server/bot-security/security-errors";
import { createHash } from "node:crypto";

export type CanonicalRequestInput = {
  domain: string;
  method: string;
  path: string;
  keyId: string;
  timestamp: number;
  nonce: string;
  requestId: string;
  bodySha256: string;
};

export function toRawBytes(body: Uint8Array | ArrayBuffer): Uint8Array {
  return body instanceof Uint8Array ? new Uint8Array(body) : new Uint8Array(body);
}

export function sha256Hex(body: Uint8Array | ArrayBuffer): string {
  return createHash("sha256").update(toRawBytes(body)).digest("hex");
}

export function buildCanonicalRequest(input: CanonicalRequestInput): string {
  if (!input.domain || input.domain.trim() !== input.domain || input.domain.includes("\n")) {
    throw new BotSecurityError("invalid_domain");
  }
  if (input.method !== "POST") {
    throw new BotSecurityError("unsupported_method");
  }

  if (!input.path.startsWith("/") || input.path.includes("?") || input.path.includes("#")) {
    throw new BotSecurityError("invalid_path");
  }

  return [
    input.domain,
    input.method,
    input.path,
    input.keyId,
    String(input.timestamp),
    input.nonce,
    input.requestId,
    input.bodySha256,
  ].join("\n");
}
