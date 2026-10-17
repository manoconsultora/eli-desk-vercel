import { createNonceReservation } from "../../server/bot-security/nonce-replay";
import { BotSecurityError } from "../../server/bot-security/security-errors";
import { digestForLog, noopSecurityObserver } from "../../server/bot-security/security-observability";
import { buildCanonicalRequest, sha256Hex, toRawBytes } from "./canonical-request";
import { parseSignedHeaders } from "./request-headers";
import type {
  AuthenticatedTechnicalPrincipal,
  BotKeyRegistry,
  BotSecurityEnvironment,
  HeaderSource,
  NonceReplayStore,
  SecurityObserver,
} from "./security-types";
import { createHmac, timingSafeEqual } from "node:crypto";

const AUTHENTICATION_WINDOW_SECONDS = 5 * 60;

export type VerifySignedRequestInput = {
  method: string;
  path: string;
  rawBody: Uint8Array | ArrayBuffer;
  headers: HeaderSource;
  environment: BotSecurityEnvironment;
  keyRegistry: BotKeyRegistry;
  nonceStore: NonceReplayStore;
  now?: () => number;
  observer?: SecurityObserver;
};

function signatureBytes(value: string): Uint8Array {
  return Buffer.from(value.slice("v1=".length), "base64url");
}

function computeSignature(secret: string | Uint8Array, canonicalRequest: string): Uint8Array {
  return createHmac("sha256", secret).update(canonicalRequest, "utf8").digest();
}

function signaturesMatch(actual: string, expected: Uint8Array): boolean {
  const received = signatureBytes(actual);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function validateTimestamp(timestamp: number, nowSeconds: number): void {
  if (Math.abs(nowSeconds - timestamp) > AUTHENTICATION_WINDOW_SECONDS) {
    throw new BotSecurityError("timestamp_outside_window");
  }
}

function recordRejection(
  observer: SecurityObserver,
  error: BotSecurityError,
  metadata: {
    environment: BotSecurityEnvironment;
    keyId?: string;
    requestId?: string;
    nonce?: string;
    bodyDigest?: string;
  },
): void {
  void observer.record({
    event: "authentication_rejected",
    code: error.code,
    environment: metadata.environment,
    keyId: metadata.keyId,
    requestId: metadata.requestId,
    nonceDigest: metadata.nonce ? digestForLog(metadata.nonce) : undefined,
    bodyDigest: metadata.bodyDigest,
  });
}

export async function verifySignedRequest(input: VerifySignedRequestInput): Promise<AuthenticatedTechnicalPrincipal> {
  const observer = input.observer ?? noopSecurityObserver;
  const rawBody = toRawBytes(input.rawBody);
  const bodyDigest = sha256Hex(rawBody);
  let keyId: string | undefined;
  let requestId: string | undefined;
  let nonce: string | undefined;

  try {
    const headers = parseSignedHeaders(input.headers);
    keyId = headers.keyId;
    requestId = headers.requestId;
    nonce = headers.nonce;

    if (headers.bodySha256 !== bodyDigest) {
      throw new BotSecurityError("body_hash_mismatch");
    }

    const key = await input.keyRegistry.resolve(headers.keyId, input.environment);
    if (!key) {
      throw new BotSecurityError("unknown_key");
    }

    if (key.keyId !== headers.keyId) {
      throw new BotSecurityError("key_identity_mismatch");
    }

    if (key.environment !== input.environment) {
      throw new BotSecurityError("key_environment_mismatch");
    }

    const nowMilliseconds = input.now?.() ?? Date.now();
    const nowSeconds = Math.floor(nowMilliseconds / 1000);

    if (key.state === "revoked") {
      throw new BotSecurityError("key_revoked");
    }

    if (key.state === "retiring" && (key.validUntil === undefined || nowSeconds > key.validUntil)) {
      throw new BotSecurityError("key_expired");
    }

    const canonicalRequest = buildCanonicalRequest({
      method: input.method,
      path: input.path,
      keyId: headers.keyId,
      timestamp: headers.timestamp,
      nonce: headers.nonce,
      requestId: headers.requestId,
      bodySha256: headers.bodySha256,
    });
    const expectedSignature = computeSignature(key.secret, canonicalRequest);

    if (!signaturesMatch(headers.signature, expectedSignature)) {
      throw new BotSecurityError("invalid_signature");
    }

    validateTimestamp(headers.timestamp, nowSeconds);

    const reservation = await input.nonceStore.reserve(
      createNonceReservation({
        environment: input.environment,
        keyId: headers.keyId,
        nonce: headers.nonce,
        requestId: headers.requestId,
        now: nowSeconds,
      }),
    );

    if (reservation === "replay") {
      throw new BotSecurityError("nonce_replay");
    }

    if (reservation !== "reserved") {
      throw new BotSecurityError("nonce_store_unavailable");
    }

    const principal: AuthenticatedTechnicalPrincipal = {
      kind: "technical_integration",
      name: "integration:n8n",
      principalId: key.principalId,
      environment: input.environment,
      requestId: headers.requestId,
      keyId: headers.keyId,
      tenantAuthority: null,
      businessAuthority: false,
    };

    void observer.record({
      event: "authentication_succeeded",
      environment: input.environment,
      keyId: headers.keyId,
      requestId: headers.requestId,
      nonceDigest: digestForLog(headers.nonce),
      bodyDigest,
    });

    return principal;
  } catch (error) {
    const securityError = error instanceof BotSecurityError ? error : new BotSecurityError("nonce_store_unavailable");
    recordRejection(observer, securityError, {
      environment: input.environment,
      keyId,
      requestId,
      nonce,
      bodyDigest,
    });
    throw securityError;
  }
}
