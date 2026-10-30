import type { AuthenticatedTechnicalPrincipal } from "../../lib/bot-security/security-types";
import { dispatchRegisteredCapability } from "../bot-api/authorization";
import {
  type BotTicketPersistence,
  executeCreateTicketCommand,
  fingerprintBotTicketInput,
  normalizeBotProposal,
} from "./create-ticket-command";
import assert from "node:assert/strict";
import { test } from "node:test";

const principal: AuthenticatedTechnicalPrincipal = {
  kind: "technical_integration",
  name: "integration:n8n",
  principalId: "n8n-bot-dev",
  environment: "dev",
  requestId: "signed-request",
  keyId: "key-1",
  tenantAuthority: null,
  businessAuthority: false,
};

const context = {
  channel: "telegram" as const,
  channelUserId: "channel-user-a",
  organizationId: "org-a",
  residentId: "resident-a",
  unitId: "unit-a",
  unitNumber: "1A",
  consorcioId: "building-a",
  unitOrigin: "inferred_single_link" as const,
};

const proposal = {
  ticketType: "consulta" as const,
  priority: "normal" as const,
  category: "agua",
  description: "No hay presión de agua.",
};

function botCommand(overrides: Partial<typeof context> = {}) {
  return {
    actor: {
      kind: "bot" as const,
      principal,
      context: { ...context, ...overrides },
      idempotencyKey: "operation-1",
      proposal,
      chatId: "telegram:sender-a",
    },
  };
}

test("normalizes and fingerprints equivalent business input deterministically", () => {
  const normalized = normalizeBotProposal(proposal);
  assert.equal(fingerprintBotTicketInput(normalized), fingerprintBotTicketInput({ ...normalized, category: "agua" }));
  assert.notEqual(
    fingerprintBotTicketInput(normalized),
    fingerprintBotTicketInput({ ...normalized, description: "Otra descripción." }),
  );
});

test("Bot command takes all tenant and actor authority from BotContext/principal", async () => {
  let received: Parameters<BotTicketPersistence["createIdempotentTicket"]>[0] | undefined;
  const botPersistence: BotTicketPersistence = {
    async createIdempotentTicket(input) {
      received = input;
      return { outcome: "created", ticketId: "ticket-a", ticketCode: "ELI-2609-0001" };
    },
  };
  await executeCreateTicketCommand(botCommand(), { botPersistence });
  assert.equal(received?.organizationId, "org-a");
  assert.equal(received?.edificioId, "building-a");
  assert.equal(received?.unidadId, "unit-a");
  assert.equal(received?.unitOrigin, "inferred_single_link");
  assert.equal(received?.residentId, "resident-a");
  assert.equal(received?.channelUserId, "channel-user-a");
  assert.equal(received?.createdByChannelUserId, "channel-user-a");
  assert.equal(received?.principalId, "n8n-bot-dev");
  assert.equal(received?.capability, "tickets.create");
});

test("same normalized business input produces the same fingerprint independent of object order", () => {
  const first = normalizeBotProposal(proposal);
  const second = normalizeBotProposal({
    description: proposal.description,
    category: proposal.category,
    priority: proposal.priority,
    ticketType: proposal.ticketType,
  });
  assert.equal(fingerprintBotTicketInput(first), fingerprintBotTicketInput(second));
});

test("created and existing map to authoritative ticket references", async () => {
  const created = await executeCreateTicketCommand(botCommand(), {
    botPersistence: {
      async createIdempotentTicket() {
        return { outcome: "created", ticketId: "ticket-a", ticketCode: "ELI-2609-0001" };
      },
    },
  });
  const existing = await executeCreateTicketCommand(botCommand(), {
    botPersistence: {
      async createIdempotentTicket() {
        return { outcome: "existing", ticketId: "ticket-a", ticketCode: "ELI-2609-0001" };
      },
    },
  });
  assert.deepEqual(created, { actor: "bot", outcome: "created", ticketId: "ticket-a", ticketCode: "ELI-2609-0001" });
  assert.deepEqual(existing, { actor: "bot", outcome: "existing", ticketId: "ticket-a", ticketCode: "ELI-2609-0001" });
});

test("conflict never returns a ticket reference", async () => {
  const result = await executeCreateTicketCommand(botCommand(), {
    botPersistence: {
      async createIdempotentTicket() {
        return { outcome: "conflict" };
      },
    },
  });
  assert.deepEqual(result, { actor: "bot", outcome: "conflict" });
});

test("Desk adapter remains on the shared command", async () => {
  const ticket = { id: "ticket-desk", ticket_code: "ELI-2609-0002" } as never;
  let received: { organizationId: string; userId: string } | undefined;
  const result = await executeCreateTicketCommand(
    {
      actor: { kind: "desk", organizationId: "org-desk", userId: "user-desk" },
      input: {
        edificio_id: "building-desk",
        ticket_type: "consulta",
        priority: "normal",
        category: null,
        description: "Consulta",
      },
    },
    {
      async createDeskTicket(_input, organizationId, userId) {
        received = { organizationId, userId };
        return ticket;
      },
    },
  );
  assert.deepEqual(received, { organizationId: "org-desk", userId: "user-desk" });
  assert.equal(result.actor, "desk");
});

test("API dispatch returns success for created and existing, conflict for conflict", async () => {
  const request = {
    apiVersion: "v1" as const,
    correlationId: "corr-1",
    idempotencyKey: "operation-1",
    capability: "tickets.create" as const,
    source: { channel: "telegram" as const, externalSenderId: "sender-a" },
    input: proposal,
  };
  const base = { request, principal, context };
  const success = await dispatchRegisteredCapability(base, {
    async createIdempotentTicket() {
      return { outcome: "created", ticketId: "ticket-a", ticketCode: "ELI-2609-0001" };
    },
  });
  const existing = await dispatchRegisteredCapability(base, {
    async createIdempotentTicket() {
      return { outcome: "existing", ticketId: "ticket-a", ticketCode: "ELI-2609-0001" };
    },
  });
  const conflict = await dispatchRegisteredCapability(base, {
    async createIdempotentTicket() {
      return { outcome: "conflict" };
    },
  });
  assert.equal(success.outcome, "success");
  assert.equal(existing.outcome, "success");
  assert.equal(conflict.outcome, "idempotency_conflict");
});

test("API dispatch fails closed on persistence uncertainty", async () => {
  const result = await dispatchRegisteredCapability(
    {
      request: {
        apiVersion: "v1",
        correlationId: "corr-1",
        idempotencyKey: "operation-1",
        capability: "tickets.create",
        source: { channel: "telegram", externalSenderId: "sender-a" },
        input: proposal,
      },
      principal,
      context,
    },
    {
      async createIdempotentTicket() {
        throw new Error("uncertain");
      },
    },
  );
  assert.deepEqual(result, { outcome: "internal_error", retryable: true });
});

test("API dispatch returns unit number and origin on success and duplicate (case: deduced unit confirmation)", async () => {
  const request = {
    apiVersion: "v1" as const,
    correlationId: "corr-2",
    idempotencyKey: "operation-2",
    capability: "tickets.create" as const,
    source: { channel: "telegram" as const, externalSenderId: "sender-a" },
    input: proposal,
  };
  const created = await dispatchRegisteredCapability(
    { request, principal, context },
    {
      async createIdempotentTicket() {
        return { outcome: "created", ticketId: "ticket-a", ticketCode: "ELI-2609-0001" };
      },
    },
  );
  assert.deepEqual(created, {
    outcome: "success",
    retryable: false,
    result: { ticketId: "ticket-a", ticketCode: "ELI-2609-0001", unitNumber: "1A", unitOrigin: "inferred_single_link" },
  });
  const provided = await dispatchRegisteredCapability(
    { request, principal, context: { ...context, unitOrigin: "provided" as const } },
    {
      async findRecentMatchingTicket() {
        return { ticketId: "ticket-b", ticketCode: "ELI-2609-0009" };
      },
      async createIdempotentTicket() {
        throw new Error("must not create");
      },
    },
  );
  assert.deepEqual(provided, {
    outcome: "duplicate",
    retryable: false,
    result: { ticketId: "ticket-b", ticketCode: "ELI-2609-0009", unitNumber: "1A", unitOrigin: "provided" },
  });
});
