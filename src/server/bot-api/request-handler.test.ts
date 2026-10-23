import type { BotIdentityRepository } from "../../lib/bot-identity/identity-types";
import type {
  AuthenticatedTechnicalPrincipal,
  BotKeyRegistry,
  NonceReplayStore,
} from "../../lib/bot-security/security-types";
import { BotSecurityError } from "../bot-security/security-errors";
import { authorizeBotCapability, dispatchRegisteredCapability } from "./authorization";
import { type BotApiHandlerDependencies, handleBotApiRequest } from "./request-handler";
import assert from "node:assert/strict";
import { test } from "node:test";

const principal: AuthenticatedTechnicalPrincipal = {
  kind: "technical_integration",
  name: "integration:n8n",
  principalId: "n8n-bot-dev",
  environment: "dev",
  requestId: "signed-request-1",
  keyId: "key-1",
  tenantAuthority: null,
  businessAuthority: false,
};

const context = {
  channel: "telegram" as const,
  channelUserId: "channel-user-1",
  organizationId: "org-1",
  residentId: "resident-1",
  unitId: "unit-1",
  consorcioId: "building-1",
};

const repository: BotIdentityRepository = {
  async findChannelCandidates() {
    return [
      {
        channelUserId: context.channelUserId,
        channelUserStatus: "active" as const,
        organizationId: context.organizationId,
        organizationStatus: "active",
        residentId: context.residentId,
        residentOrganizationId: context.organizationId,
        residentActive: true,
        links: [
          {
            organizationId: context.organizationId,
            unitId: context.unitId,
            unitOrganizationId: context.organizationId,
            consorcioId: context.consorcioId,
            consorcioOrganizationId: context.organizationId,
          },
        ],
      },
    ];
  },
};

function candidate(
  overrides: Partial<Awaited<ReturnType<BotIdentityRepository["findChannelCandidates"]>>[number]> = {},
) {
  return {
    channelUserId: context.channelUserId,
    channelUserStatus: "active" as const,
    organizationId: context.organizationId,
    organizationStatus: "active",
    residentId: context.residentId,
    residentOrganizationId: context.organizationId,
    residentActive: true,
    links: [
      {
        organizationId: context.organizationId,
        unitId: context.unitId,
        unitOrganizationId: context.organizationId,
        consorcioId: context.consorcioId,
        consorcioOrganizationId: context.organizationId,
      },
    ],
    ...overrides,
  };
}

const keyRegistry = {} as BotKeyRegistry;
const nonceStore = {} as NonceReplayStore;

function request(body: unknown) {
  return new Request("https://eli.test/api/integrations/n8n/v1/tickets.create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    apiVersion: "v1",
    correlationId: "corr-1",
    idempotencyKey: "idempotency-1",
    capability: "tickets.create",
    source: { channel: "telegram", externalSenderId: "telegram-1" },
    input: { ticketType: "consulta", description: "Necesito ayuda" },
    ...overrides,
  };
}

function dependencies(
  options: {
    identity?: BotIdentityRepository;
    dispatch?: BotApiHandlerDependencies["dispatch"];
    verify?: (input: VerifyInput) => Promise<AuthenticatedTechnicalPrincipal>;
    readBody?: BotApiHandlerDependencies["readBody"];
  } = {},
) {
  return {
    environment: "dev" as const,
    keyRegistry,
    nonceStore,
    identityRepository: options.identity ?? repository,
    authorize: authorizeBotCapability,
    dispatch: options.dispatch ?? dispatchRegisteredCapability,
    verify: options.verify ?? (async () => principal),
    readBody: options.readBody,
  };
}

type VerifyInput = Parameters<NonNullable<Parameters<typeof handleBotApiRequest>[1]["verify"]>>[0];

test("does not call identity when SEC-01 fails", async () => {
  let identityCalls = 0;
  const identity: BotIdentityRepository = {
    async findChannelCandidates() {
      identityCalls += 1;
      return [];
    },
  };
  const response = await handleBotApiRequest(
    request(validBody()),
    dependencies({
      identity,
      verify: async () => {
        throw new Error("invalid HMAC");
      },
    }),
  );
  assert.equal(response.status, 401);
  assert.equal(identityCalls, 0);
});

test("parses raw body once and dispatches after SEC, identity and authorization", async () => {
  let readBodyCalls = 0;
  let identityCalls = 0;
  let dispatchCalls = 0;
  const tracked = request(validBody());
  const identity: BotIdentityRepository = {
    async findChannelCandidates() {
      identityCalls += 1;
      return repository.findChannelCandidates("telegram", "telegram-1");
    },
  };
  const response = await handleBotApiRequest(
    tracked,
    dependencies({
      identity,
      dispatch: (input: Parameters<BotApiHandlerDependencies["dispatch"]>[0]) => {
        dispatchCalls += 1;
        void input;
        return { outcome: "success", retryable: false, result: { ticketId: "ticket-1", ticketCode: "ELI-2609-0001" } };
      },
      readBody: async (input) => {
        readBodyCalls += 1;
        return new Uint8Array(await input.arrayBuffer());
      },
    }),
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.outcome, "success");
  assert.equal("error" in payload, false);
  assert.deepEqual(payload.result, { ticketId: "ticket-1", ticketCode: "ELI-2609-0001" });
  assert.equal(readBodyCalls, 1);
  assert.equal(identityCalls, 1);
  assert.equal(dispatchCalls, 1);
});

test("routes a signed WhatsApp tickets.create request through channel identity", async () => {
  let lookedUp: { channel: string; senderId: string } | null = null;
  const dispatched: { value?: Parameters<BotApiHandlerDependencies["dispatch"]>[0] } = {};
  const response = await handleBotApiRequest(
    request(validBody({ source: { channel: "whatsapp", externalSenderId: "5491123456789" } })),
    dependencies({
      identity: {
        async findChannelCandidates(channel, senderId) {
          lookedUp = { channel, senderId };
          return [candidate()];
        },
      },
      dispatch: (input) => {
        dispatched.value = input;
        return { outcome: "success", retryable: false, result: { ticketId: "ticket-1", ticketCode: "ELI-2609-0001" } };
      },
    }),
  );
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(lookedUp, { channel: "whatsapp", senderId: "5491123456789" });
  assert.equal(dispatched.value?.request.source.channel, "whatsapp");
  assert.equal(dispatched.value?.context.channel, "whatsapp");
  assert.equal(payload.outcome, "success");
  assert.equal("error" in payload, false);
});

test("rejects malformed payload after authentication without dispatch", async () => {
  let dispatchCalls = 0;
  const response = await handleBotApiRequest(
    request(validBody({ idempotencyKey: undefined })),
    dependencies({
      dispatch: () => {
        dispatchCalls += 1;
        return dispatchRegisteredCapability();
      },
    }),
  );
  assert.equal(response.status, 422);
  assert.equal(dispatchCalls, 0);
});

test("requires correlationId and idempotencyKey", async () => {
  const missingCorrelation = await handleBotApiRequest(
    request(validBody({ correlationId: undefined })),
    dependencies(),
  );
  const missingIdempotency = await handleBotApiRequest(
    request(validBody({ idempotencyKey: undefined })),
    dependencies(),
  );
  assert.equal((await missingCorrelation.json()).error.code, "missing_correlation_id");
  assert.equal((await missingIdempotency.json()).error.code, "missing_idempotency_key");
});

test("rejects body requestId and inbound tenant selectors", async () => {
  const bodyRequestId = await handleBotApiRequest(
    request(validBody({ requestId: "attacker-request" })),
    dependencies(),
  );
  const tenantSelector = await handleBotApiRequest(
    request(validBody({ input: { ticketType: "consulta", description: "x", organizationId: "attacker-org" } })),
    dependencies(),
  );
  assert.equal((await bodyRequestId.json()).error.code, "body_request_id_not_allowed");
  assert.equal((await tenantSelector.json()).error.code, "unexpected_input_field");
});

test("maps identity failures without dispatch", async () => {
  let dispatchCalls = 0;
  const identity: BotIdentityRepository = {
    async findChannelCandidates() {
      return [];
    },
  };
  const response = await handleBotApiRequest(
    request(validBody()),
    dependencies({
      identity,
      dispatch: () => {
        dispatchCalls += 1;
        return dispatchRegisteredCapability();
      },
    }),
  );
  assert.equal(response.status, 422);
  assert.equal((await response.json()).outcome, "identity_unresolved");
  assert.equal(dispatchCalls, 0);
});

test("wrong technical principal is denied", async () => {
  const wrongPrincipal = { ...principal, principalId: "other-principal" };
  const response = await handleBotApiRequest(
    request(validBody()),
    dependencies({ verify: async () => wrongPrincipal }),
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).outcome, "capability_denied");
});

test("unsupported capability fails closed", async () => {
  const response = await handleBotApiRequest(request(validBody({ capability: "tickets.delete" })), dependencies());
  assert.equal(response.status, 422);
  assert.equal((await response.json()).outcome, "invalid_request");
});

test("rejects an invalid API version at the handler boundary", async () => {
  const response = await handleBotApiRequest(request(validBody({ apiVersion: "v2" })), dependencies());
  assert.equal(response.status, 422);
  assert.equal((await response.json()).error.code, "unsupported_api_version");
});

test("maps every non-resolved identity outcome without dispatch", async () => {
  const cases: Array<{
    name: string;
    candidates: Awaited<ReturnType<BotIdentityRepository["findChannelCandidates"]>>;
    outcome: string;
  }> = [
    { name: "blocked", candidates: [candidate({ channelUserStatus: "blocked" })], outcome: "identity_blocked" },
    { name: "inactive", candidates: [candidate({ channelUserStatus: "inactive" })], outcome: "identity_inactive" },
    {
      name: "ambiguous unit",
      candidates: [candidate({ links: [candidate().links[0], { ...candidate().links[0], unitId: "unit-2" }] })],
      outcome: "clarification_required",
    },
    {
      name: "ambiguous organization",
      candidates: [
        candidate(),
        candidate({
          organizationId: "org-2",
          residentOrganizationId: "org-2",
          links: [
            {
              ...candidate().links[0],
              organizationId: "org-2",
              unitOrganizationId: "org-2",
              consorcioOrganizationId: "org-2",
            },
          ],
        }),
      ],
      outcome: "clarification_required",
    },
    {
      name: "cross tenant",
      candidates: [candidate({ links: [{ ...candidate().links[0], unitOrganizationId: "other-org" }] })],
      outcome: "cross_tenant",
    },
  ];

  for (const testCase of cases) {
    let dispatchCalls = 0;
    const response = await handleBotApiRequest(
      request(validBody({ correlationId: `corr-${testCase.name}` })),
      dependencies({
        identity: {
          async findChannelCandidates() {
            return testCase.candidates;
          },
        },
        dispatch: () => {
          dispatchCalls += 1;
          return dispatchRegisteredCapability();
        },
      }),
    );
    assert.equal((await response.json()).outcome, testCase.outcome, testCase.name);
    assert.equal(dispatchCalls, 0, testCase.name);
  }
});

test("denies a principal from the wrong environment before dispatch", async () => {
  let dispatchCalls = 0;
  const response = await handleBotApiRequest(
    request(validBody()),
    dependencies({
      verify: async () => ({ ...principal, environment: "prod" }),
      dispatch: () => {
        dispatchCalls += 1;
        return dispatchRegisteredCapability();
      },
    }),
  );
  assert.equal(response.status, 403);
  assert.equal((await response.json()).outcome, "capability_denied");
  assert.equal(dispatchCalls, 0);
});

test("maps replay, nonce-store, stale, and invalid-HMAC failures before identity", async () => {
  const failures: Array<{ error: BotSecurityError; outcome: string }> = [
    { error: new BotSecurityError("nonce_replay"), outcome: "replay" },
    { error: new BotSecurityError("nonce_store_unavailable"), outcome: "authentication_failed" },
    { error: new BotSecurityError("timestamp_outside_window"), outcome: "authentication_failed" },
    { error: new BotSecurityError("invalid_signature"), outcome: "authentication_failed" },
  ];
  for (const failure of failures) {
    let identityCalls = 0;
    const response = await handleBotApiRequest(
      request(validBody()),
      dependencies({
        identity: {
          async findChannelCandidates() {
            identityCalls += 1;
            return [];
          },
        },
        verify: async () => {
          throw failure.error;
        },
      }),
    );
    assert.equal((await response.json()).outcome, failure.outcome, failure.error.code);
    assert.equal(identityCalls, 0, failure.error.code);
  }
});
