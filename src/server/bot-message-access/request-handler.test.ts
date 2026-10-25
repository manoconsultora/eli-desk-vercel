import type { BotIdentityCandidate } from "../../lib/bot-identity/identity-types";
import { buildCanonicalRequest, sha256Hex } from "../../lib/bot-security/canonical-request";
import type { BotKeyRegistry, NonceReplayStore } from "../../lib/bot-security/security-types";
import { handleMessageAccessRequest } from "./request-handler";
import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { compileFunction } from "node:vm";

const path = "/api/integrations/n8n/v1/messages.authorize";
const fixtureSecret = "unit-test-only-message-access-key";
const candidate: BotIdentityCandidate = {
  channelUserId: "channel-1",
  channelUserStatus: "active",
  organizationId: "org-1",
  organizationStatus: "active",
  residentId: "resident-1",
  residentOrganizationId: "org-1",
  residentActive: true,
  links: ["1A", "4B"].map((unitNumber) => ({
    unitId: `unit-${unitNumber}`,
    unitNumber,
    organizationId: "org-1",
    unitOrganizationId: "org-1",
    consorcioId: "building-1",
    consorcioOrganizationId: "org-1",
  })),
};

function body(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: "v1",
    capability: "messages.authorize",
    correlationId: "wa-test-1",
    source: { channel: "whatsapp", externalSenderId: "5491100000001" },
    ...overrides,
  };
}

function signedRequest(
  payload: unknown = body(),
  options: {
    signedPath?: string;
    timestamp?: number;
    badSignature?: boolean;
    rawBody?: string;
  } = {},
) {
  const rawBody = new TextEncoder().encode(options.rawBody ?? JSON.stringify(payload));
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const nonce = randomBytes(16).toString("base64url");
  const requestId = randomUUID();
  const hash = sha256Hex(rawBody);
  const canonical = buildCanonicalRequest({
    domain: "ELI-N8N-BOT-API-V1",
    method: "POST",
    path: options.signedPath ?? path,
    keyId: "test-access-key",
    timestamp,
    nonce,
    requestId,
    bodySha256: hash,
  });
  const signature = createHmac("sha256", options.badSignature ? "wrong-key" : fixtureSecret)
    .update(canonical)
    .digest("base64url");
  return new Request(`https://eli.test${path}`, {
    method: "POST",
    body: rawBody,
    headers: {
      "content-type": "application/json",
      "X-ELI-Key-Id": "test-access-key",
      "X-ELI-Timestamp": String(timestamp),
      "X-ELI-Nonce": nonce,
      "X-ELI-Request-Id": requestId,
      "X-ELI-Body-SHA256": hash,
      "X-ELI-Signature": `v1=${signature}`,
    },
  });
}

function dependencies(
  options: {
    candidates?: BotIdentityCandidate[];
    blocked?: boolean;
    identityError?: boolean;
    blacklistError?: boolean;
    principalId?: string;
    nonceError?: boolean;
  } = {},
) {
  const calls: unknown[][] = [];
  const nonces = new Set<string>();
  const keyRegistry: BotKeyRegistry = {
    async resolve(keyId, environment) {
      return {
        keyId,
        environment,
        state: "active",
        secret: fixtureSecret,
        principalId: options.principalId ?? "n8n-bot-dev",
      };
    },
  };
  const nonceStore: NonceReplayStore = {
    async reserve(input) {
      if (options.nonceError) throw new Error("nonce unavailable");
      if (nonces.has(input.nonce)) return "replay";
      nonces.add(input.nonce);
      return "reserved";
    },
  };
  return {
    calls,
    keyRegistry,
    nonceStore,
    identityRepository: {
      async findChannelCandidates(channel: string, sender: string) {
        calls.push(["identity", channel, sender]);
        if (options.identityError) throw new Error("sensitive identity dependency error");
        return options.candidates ?? [structuredClone(candidate)];
      },
    },
    blacklistRepository: {
      async isPhoneBlocked(input: { organizationId: string; phoneDigits: string }) {
        calls.push(["blacklist", input]);
        if (options.blacklistError) throw new Error("sensitive blacklist dependency error");
        return options.blocked ?? false;
      },
    },
  };
}

test("signed SEC-01 request resolves administration, checks phone and does not select or change either unit", async () => {
  const input = [structuredClone(candidate)];
  const original = structuredClone(input);
  const deps = dependencies({ candidates: input });
  const response = await handleMessageAccessRequest(signedRequest(), deps);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    apiVersion: "v1",
    capability: "messages.authorize",
    correlationId: "wa-test-1",
    decision: "allowed",
  });
  assert.deepEqual(deps.calls, [
    ["identity", "whatsapp", "5491100000001"],
    ["blacklist", { organizationId: "org-1", phoneDigits: "5491100000001" }],
  ]);
  assert.deepEqual(input, original);
  assert.match(response.headers.get("cache-control") ?? "", /no-store/);
});

test("blocked returns only the decision and correlation, no tenant or personal data", async () => {
  const response = await handleMessageAccessRequest(signedRequest(), dependencies({ blocked: true }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    apiVersion: "v1",
    capability: "messages.authorize",
    correlationId: "wa-test-1",
    decision: "blocked",
  });
});

test("each new signed message rechecks the existing blacklist instead of caching permission", async () => {
  const options = { blocked: false };
  const deps = dependencies(options);
  assert.equal((await (await handleMessageAccessRequest(signedRequest(), deps)).json()).decision, "allowed");
  options.blocked = true;
  assert.equal((await (await handleMessageAccessRequest(signedRequest(), deps)).json()).decision, "blocked");
  assert.equal(deps.calls.filter(([operation]) => operation === "blacklist").length, 2);
});

[
  ["wrong signature", { badSignature: true }],
  ["signature for tickets.create cannot authorize messages", { signedPath: "/api/integrations/n8n/v1/tickets.create" }],
  ["expired signature", { timestamp: 1 }],
].forEach(([name, options]) => {
  test(String(name), async () => {
    const deps = dependencies();
    const response = await handleMessageAccessRequest(
      signedRequest(body(), options as Parameters<typeof signedRequest>[1]),
      deps,
    );
    assert.equal(response.status, 401);
    assert.equal((await response.json()).decision, "unavailable");
    assert.deepEqual(deps.calls, []);
  });
});

test("missing authentication cannot consult identity or blacklist", async () => {
  const deps = dependencies();
  const response = await handleMessageAccessRequest(
    new Request(`https://eli.test${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body()),
    }),
    deps,
  );
  assert.equal(response.status, 401);
  assert.deepEqual(deps.calls, []);
});

test("same signed nonce is rejected without a second identity or blacklist lookup", async () => {
  const deps = dependencies();
  const request = signedRequest();
  assert.equal((await handleMessageAccessRequest(request.clone(), deps)).status, 200);
  const response = await handleMessageAccessRequest(request.clone(), deps);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).decision, "unavailable");
  assert.equal(deps.calls.length, 2);
});

test("nonce failure and an authenticated but unauthorized principal cannot consult contacts", async () => {
  for (const options of [{ nonceError: true }, { principalId: "other-integration" }]) {
    const deps = dependencies(options);
    const response = await handleMessageAccessRequest(signedRequest(), deps);
    assert.ok([401, 403].includes(response.status));
    assert.equal((await response.json()).decision, "unavailable");
    assert.deepEqual(deps.calls, []);
  }
});

const invalidBodies: unknown[] = [
  null,
  [],
  {},
  body({ organizationId: "attacker-org" }),
  body({ principal: { principalId: "n8n-bot-dev" } }),
  body({ capability: "tickets.create" }),
  body({ correlationId: " " }),
  body({ correlationId: "a".repeat(257) }),
  body({ source: { channel: "whatsapp", externalSenderId: "5491100000001", unitNumber: "4B" } }),
  body({ source: { channel: "whatsapp", externalSenderId: "5491100000001", organizationId: "attacker-org" } }),
  body({ source: { channel: "telegram", externalSenderId: "5491100000001" } }),
  body({ source: { channel: "whatsapp", externalSenderId: 5491100000001 } }),
  body({ source: { channel: "whatsapp", externalSenderId: "x);sql" } }),
  body({ source: [] }),
];
invalidBodies.forEach((payload, index) => {
  test(`invalid source / authority input ${index} fails before identity`, async () => {
    const deps = dependencies();
    const response = await handleMessageAccessRequest(signedRequest(payload), deps);
    assert.equal(response.status, 422);
    assert.equal((await response.json()).decision, "unavailable");
    assert.deepEqual(deps.calls, []);
  });
});

test("malformed JSON after valid signature is unavailable", async () => {
  const deps = dependencies();
  const response = await handleMessageAccessRequest(signedRequest(null, { rawBody: "{" }), deps);
  assert.equal(response.status, 422);
  assert.deepEqual(deps.calls, []);
});

const deniedCandidates: BotIdentityCandidate[][] = [
  [],
  [candidate, { ...candidate, organizationId: "org-2" }],
  [{ ...candidate, channelUserStatus: "blocked" }],
  [{ ...candidate, channelUserStatus: "inactive" }],
  [{ ...candidate, residentActive: null }],
  [{ ...candidate, residentActive: false }],
  [{ ...candidate, residentId: null }],
  [{ ...candidate, residentOrganizationId: "org-2" }],
  [{ ...candidate, organizationStatus: "suspended" }],
  [{ ...candidate, links: [] }],
  [{ ...candidate, links: [{ ...candidate.links[0], unitOrganizationId: "org-2" }] }],
  [{ ...candidate, links: [{ ...candidate.links[0], organizationId: "org-2" }] }],
  [{ ...candidate, links: [{ ...candidate.links[0], consorcioId: null }] }],
  [{ ...candidate, links: [{ ...candidate.links[0], consorcioOrganizationId: "org-2" }] }],
];
deniedCandidates.forEach((candidates, index) => {
  test(`unverified administration ${index} never queries blacklist`, async () => {
    const deps = dependencies({ candidates });
    const response = await handleMessageAccessRequest(signedRequest(), deps);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).decision, "unavailable");
    assert.equal(deps.calls.length, 1);
  });
});

test("dependency failures are unavailable and redact private errors", async () => {
  for (const options of [{ identityError: true }, { blacklistError: true }]) {
    const response = await handleMessageAccessRequest(signedRequest(), dependencies(options));
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.match(text, /unavailable/);
    assert.doesNotMatch(text, /sensitive/);
  }
});

test("body size, method and content type failures do not query contacts", async () => {
  const deps = dependencies();
  const requests = [
    new Request(`https://eli.test${path}`, { method: "GET" }),
    new Request(`https://eli.test${path}`, { method: "POST", body: "x" }),
    new Request(`https://eli.test${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "a".repeat(65537),
    }),
  ];
  for (const request of requests) {
    const response = await handleMessageAccessRequest(request, deps);
    assert.ok([400, 413].includes(response.status));
    assert.equal((await response.json()).decision, "unavailable");
  }
  assert.deepEqual(deps.calls, []);
});

test("authenticated server response drives the actual V3 gate, preserving recipient and denial text", async () => {
  const code = await readFile(
    new URL("../../../n8n/whatsapp-blacklist-review/evaluate-check.js.txt", import.meta.url),
    "utf8",
  );
  const evaluate = compileFunction(code, ["$json", "$"]);
  const context = {
    channel: "whatsapp",
    externalSenderId: "5491100000001",
    chatId: "5491100000001",
    phoneNumberId: "test-phone",
    correlationId: "wa-test-1",
    idempotencyKey: "idem-1",
    providerMessageType: "text",
    inputValid: true,
    message: "Reclamo para 4B",
  };
  for (const options of [{ blocked: true }, { blocked: false }, { blacklistError: true }]) {
    const response = await handleMessageAccessRequest(signedRequest(), dependencies(options));
    const result = evaluate({ statusCode: response.status, body: await response.json() }, () => ({
      item: { json: { context } },
    })).json;
    assert.equal(result.chatId, context.chatId);
    assert.equal(result.phoneNumberId, context.phoneNumberId);
    assert.equal(result.idempotencyKey, context.idempotencyKey);
    assert.equal(result.accessAllowed, !options.blocked && !options.blacklistError);
    if (options.blocked) {
      assert.equal(
        result.responseText,
        "[BL] Acceso Denegado. Recomendamos contactar al Administrador de tu Edificio.",
      );
    }
    if (options.blacklistError) assert.equal(result.outcome, "service_unavailable");
  }
});
