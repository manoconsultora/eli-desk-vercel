import { buildCanonicalRequest, sha256Hex } from "../../lib/bot-security/canonical-request";
import { verifySignedRequest } from "../../lib/bot-security/hmac-verifier";
import { parseSignedHeaders } from "../../lib/bot-security/request-headers";
import type {
  BotHmacKey,
  BotKeyRegistry,
  BotSecurityEnvironment,
  HeaderSource,
  NonceReplayStore,
  NonceReservation,
  SecurityObserver,
} from "../../lib/bot-security/security-types";
import { BotSecurityError } from "./security-errors";
import { createSecurityObserver, digestForLog } from "./security-observability";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

const NOW_SECONDS = 1_800_000_000;
const SECRET = "test-only-secret-never-used-in-production";
const BODY = Buffer.from('{"description":"test"}', "utf8");

class TestKeyRegistry implements BotKeyRegistry {
  constructor(private readonly key: BotHmacKey | null) {}

  async resolve(): Promise<BotHmacKey | null> {
    return this.key;
  }
}

class TestNonceStore implements NonceReplayStore {
  public reservations: NonceReservation[] = [];

  constructor(private readonly result: "reserved" | "replay" | "unknown" = "reserved") {}

  async reserve(input: NonceReservation) {
    this.reservations.push(input);
    return this.result;
  }
}

class TestHeaders implements HeaderSource {
  constructor(private readonly values: Record<string, string | string[]>) {}

  get(name: string): string | null {
    const value = this.values[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    return value ?? null;
  }

  getAll(name: string): readonly string[] {
    const value = this.values[name.toLowerCase()];
    return value === undefined ? [] : Array.isArray(value) ? value : [value];
  }
}

function createKey(overrides: Partial<BotHmacKey> = {}): BotHmacKey {
  return {
    environment: "dev",
    keyId: "dev-key-1",
    state: "active",
    secret: SECRET,
    principalId: "n8n-bot-dev",
    ...overrides,
  };
}

function signedRequest(
  overrides: {
    body?: Uint8Array;
    environment?: BotSecurityEnvironment;
    key?: BotHmacKey;
    nonce?: string;
    requestId?: string;
    timestamp?: number;
    signature?: string;
    headerBodyHash?: string;
    path?: string;
    method?: string;
    domain?: string;
  } = {},
) {
  const body = overrides.body ?? BODY;
  const key = overrides.key ?? createKey();
  const nonce = overrides.nonce ?? "AAAAAAAAAAAAAAAAAAAAAA";
  const requestId = overrides.requestId ?? "request-001";
  const timestamp = overrides.timestamp ?? NOW_SECONDS;
  const path = overrides.path ?? "/api/integrations/n8n/v1/tickets.create";
  const method = overrides.method ?? "POST";
  const bodySha256 = overrides.headerBodyHash ?? sha256Hex(body);
  const domain = overrides.domain ?? "ELI-N8N-BOT-API-V1";
  const canonical = buildCanonicalRequest({
    domain,
    method,
    path,
    keyId: key.keyId,
    timestamp,
    nonce,
    requestId,
    bodySha256,
  });
  const signature =
    overrides.signature ?? `v1=${createHmac("sha256", key.secret).update(canonical).digest("base64url")}`;

  return {
    domain,
    rawBody: body,
    method,
    path,
    environment: overrides.environment ?? "dev",
    headers: new TestHeaders({
      "x-eli-key-id": key.keyId,
      "x-eli-timestamp": String(timestamp),
      "x-eli-nonce": nonce,
      "x-eli-request-id": requestId,
      "x-eli-body-sha256": bodySha256,
      "x-eli-signature": signature,
    }),
  };
}

async function expectSecurityError(action: () => Promise<unknown>, code: string): Promise<BotSecurityError> {
  try {
    await action();
    assert.fail(`Expected ${code}`);
  } catch (error) {
    assert.ok(error instanceof BotSecurityError);
    assert.equal(error.code, code);
    return error;
  }
}

function verifyInput(
  request: ReturnType<typeof signedRequest>,
  options: {
    key?: BotHmacKey | null;
    nonceResult?: "reserved" | "replay" | "unknown";
    now?: number;
    observer?: SecurityObserver;
  } = {},
) {
  return verifySignedRequest({
    ...request,
    keyRegistry: new TestKeyRegistry(options.key === undefined ? createKey() : options.key),
    nonceStore: new TestNonceStore(options.nonceResult),
    now: () => options.now ?? NOW_SECONDS * 1000,
    observer: options.observer,
  });
}

test("builds the exact canonical request and hashes raw body bytes", () => {
  const bodyHash = sha256Hex(BODY);
  assert.equal(
    buildCanonicalRequest({
      domain: "ELI-N8N-BOT-API-V1",
      method: "POST",
      path: "/api/integrations/n8n/v1/tickets.create",
      keyId: "dev-key-1",
      timestamp: NOW_SECONDS,
      nonce: "AAAAAAAAAAAAAAAAAAAAAA",
      requestId: "request-001",
      bodySha256: bodyHash,
    }),
    [
      "ELI-N8N-BOT-API-V1",
      "POST",
      "/api/integrations/n8n/v1/tickets.create",
      "dev-key-1",
      String(NOW_SECONDS),
      "AAAAAAAAAAAAAAAAAAAAAA",
      "request-001",
      bodyHash,
    ].join("\n"),
  );
  assert.equal(bodyHash.length, 64);
});

test("accepts a valid active DEV HMAC and returns a non-tenant principal", async () => {
  const request = signedRequest();
  const principal = await verifyInput(request);

  assert.deepEqual(principal, {
    kind: "technical_integration",
    name: "integration:n8n",
    principalId: "n8n-bot-dev",
    environment: "dev",
    requestId: "request-001",
    keyId: "dev-key-1",
    tenantAuthority: null,
    businessAuthority: false,
  });
});

test("rejects missing, malformed and duplicate signed headers", async () => {
  const request = signedRequest();
  const missing = new TestHeaders({});
  assert.throws(() => parseSignedHeaders(missing), { code: "missing_header" });

  const malformed = new TestHeaders({
    "x-eli-key-id": "dev-key-1",
    "x-eli-timestamp": "not-a-timestamp",
    "x-eli-nonce": "AAAAAAAAAAAAAAAAAAAAAA",
    "x-eli-request-id": "request-001",
    "x-eli-body-sha256": sha256Hex(BODY),
    "x-eli-signature": "v1=invalid",
  });
  assert.throws(() => parseSignedHeaders(malformed), { code: "invalid_timestamp" });

  const duplicate = new TestHeaders({
    "x-eli-key-id": ["dev-key-1", "dev-key-2"],
    "x-eli-timestamp": String(NOW_SECONDS),
    "x-eli-nonce": "AAAAAAAAAAAAAAAAAAAAAA",
    "x-eli-request-id": "request-001",
    "x-eli-body-sha256": sha256Hex(BODY),
    "x-eli-signature": "v1=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  });
  assert.throws(() => parseSignedHeaders(duplicate), { code: "duplicate_header" });
  assert.ok(request.headers);
});

test("rejects invalid HMAC and handles unequal signature lengths safely", async () => {
  const request = signedRequest({ signature: "v1=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" });
  await expectSecurityError(() => verifyInput(request), "invalid_signature");
});

test("rejects a body hash mismatch before authentication succeeds", async () => {
  const request = signedRequest({ headerBodyHash: "a".repeat(64) });
  await expectSecurityError(() => verifyInput(request), "body_hash_mismatch");
});

test("accepts timestamps inside the five-minute window and rejects old/future values", async () => {
  await verifyInput(signedRequest({ timestamp: NOW_SECONDS - 300 }));
  await expectSecurityError(
    () => verifyInput(signedRequest({ timestamp: NOW_SECONDS - 301 })),
    "timestamp_outside_window",
  );
  await expectSecurityError(
    () => verifyInput(signedRequest({ timestamp: NOW_SECONDS + 301 })),
    "timestamp_outside_window",
  );
});

test("enforces active, retiring, revoked, unknown and environment-mismatched keys", async () => {
  await verifyInput(signedRequest(), { key: createKey({ state: "active" }) });
  await verifyInput(signedRequest(), {
    key: createKey({ state: "retiring", validUntil: NOW_SECONDS + 1 }),
  });
  await expectSecurityError(
    () => verifyInput(signedRequest(), { key: createKey({ state: "retiring", validUntil: NOW_SECONDS - 1 }) }),
    "key_expired",
  );
  await expectSecurityError(
    () => verifyInput(signedRequest(), { key: createKey({ state: "retiring" }) }),
    "key_expired",
  );
  await expectSecurityError(
    () => verifyInput(signedRequest(), { key: createKey({ state: "revoked" }) }),
    "key_revoked",
  );
  await expectSecurityError(() => verifyInput(signedRequest(), { key: null }), "unknown_key");
  await expectSecurityError(
    () => verifyInput(signedRequest(), { key: createKey({ keyId: "different-key-id" }) }),
    "key_identity_mismatch",
  );
  await expectSecurityError(
    () => verifyInput(signedRequest(), { key: createKey({ environment: "prod" }) }),
    "key_environment_mismatch",
  );
});

test("reserves a nonce once and rejects replay or uncertain store results", async () => {
  const firstRequest = signedRequest();
  const firstStore = new TestNonceStore();
  await verifySignedRequest({
    ...firstRequest,
    keyRegistry: new TestKeyRegistry(createKey()),
    nonceStore: firstStore,
    now: () => NOW_SECONDS * 1000,
  });
  assert.equal(firstStore.reservations.length, 1);
  assert.equal(firstStore.reservations[0]?.retentionSeconds, 600);

  await expectSecurityError(
    () => verifyInput(signedRequest({ nonce: "BBBBBBBBBBBBBBBBBBBBBB" }), { nonceResult: "replay" }),
    "nonce_replay",
  );
  await expectSecurityError(
    () => verifyInput(signedRequest({ nonce: "CCCCCCCCCCCCCCCCCCCCCC" }), { nonceResult: "unknown" }),
    "nonce_store_unavailable",
  );
});

test("does not reserve a nonce when signature or timestamp authentication fails", async () => {
  const store = new TestNonceStore();
  const badSignature = signedRequest({ signature: "v1=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" });
  await expectSecurityError(
    () =>
      verifySignedRequest({
        ...badSignature,
        keyRegistry: new TestKeyRegistry(createKey()),
        nonceStore: store,
        now: () => NOW_SECONDS * 1000,
      }),
    "invalid_signature",
  );
  assert.equal(store.reservations.length, 0);

  const oldRequest = signedRequest({ timestamp: NOW_SECONDS - 301 });
  await expectSecurityError(
    () =>
      verifySignedRequest({
        ...oldRequest,
        keyRegistry: new TestKeyRegistry(createKey()),
        nonceStore: store,
        now: () => NOW_SECONDS * 1000,
      }),
    "timestamp_outside_window",
  );
  assert.equal(store.reservations.length, 0);
});

test("fails closed when the nonce store throws", async () => {
  const request = signedRequest({ nonce: "DDDDDDDDDDDDDDDDDDDDDD" });
  const nonceStore: NonceReplayStore = {
    async reserve() {
      throw new Error("durable store unavailable");
    },
  };

  await expectSecurityError(
    () =>
      verifySignedRequest({
        ...request,
        keyRegistry: new TestKeyRegistry(createKey()),
        nonceStore,
        now: () => NOW_SECONDS * 1000,
      }),
    "nonce_store_unavailable",
  );
});

test("uses the signed request ID and redacts observable identifiers", async () => {
  const events: unknown[] = [];
  const observer = createSecurityObserver((event) => {
    events.push(event);
  });
  const request = signedRequest({ requestId: "authoritative-request-id" });
  const principal = await verifyInput(request, { observer });

  assert.equal(principal.requestId, "authoritative-request-id");
  assert.equal((principal as { organizationId?: string }).organizationId, undefined);
  assert.equal((principal as { residentId?: string }).residentId, undefined);
  assert.equal((events[0] as { bodyDigest?: string }).bodyDigest?.length, 64);
  assert.equal((events[0] as { nonceDigest?: string }).nonceDigest?.length, 16);
  assert.equal(JSON.stringify(events).includes(SECRET), false);
  assert.equal(digestForLog(SECRET).length, 16);
});

test("returns safe errors without exposing secrets", async () => {
  const error = await expectSecurityError(
    () => verifyInput(signedRequest({ signature: "v1=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" })),
    "invalid_signature",
  );
  assert.equal(error.message.includes(SECRET), false);
  assert.equal(error.safeMessage.includes("secret"), false);
});

test("cryptographically separates BOT, MCV CLAIM and MCV COMPLETE domains", async () => {
  for (const [signedDomain, trustedDomain] of [
    ["ELI-N8N-MCV-CLAIM-V1", "ELI-N8N-MCV-COMPLETE-V1"],
    ["ELI-N8N-MCV-COMPLETE-V1", "ELI-N8N-MCV-CLAIM-V1"],
    ["ELI-N8N-BOT-API-V1", "ELI-N8N-MCV-CLAIM-V1"],
  ]) {
    const signed = signedRequest({ domain: signedDomain });
    await expectSecurityError(
      () =>
        verifySignedRequest({
          ...signed,
          domain: trustedDomain,
          keyRegistry: new TestKeyRegistry(createKey()),
          nonceStore: new TestNonceStore(),
          now: () => NOW_SECONDS * 1000,
        }),
      "invalid_signature",
    );
  }
});
