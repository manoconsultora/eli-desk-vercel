import type { BotIdentityCandidate, BotIdentityRepository } from "../../lib/bot-identity/identity-types";
import { BotIdentityInputError, BotIdentityRepositoryError } from "./identity-errors";
import { resolveBotContext } from "./resolve-bot-context";
import assert from "node:assert/strict";
import { test } from "node:test";

const baseCandidate: BotIdentityCandidate = {
  channelUserId: "channel-user-1",
  channelUserStatus: "active",
  organizationId: "org-1",
  organizationStatus: "active",
  residentId: "resident-1",
  residentOrganizationId: "org-1",
  residentActive: true,
  links: [
    {
      organizationId: "org-1",
      unitId: "unit-1",
      unitOrganizationId: "org-1",
      consorcioId: "building-1",
      consorcioOrganizationId: "org-1",
    },
  ],
};

function repository(
  candidates: BotIdentityCandidate[] | (() => Promise<BotIdentityCandidate[]>),
): BotIdentityRepository {
  return { findChannelCandidates: async () => (typeof candidates === "function" ? candidates() : candidates) };
}

function resolve(
  candidates: BotIdentityCandidate[],
  overrides: Partial<{ channel: string; externalSenderId: string }> = {},
) {
  return resolveBotContext(
    { channel: overrides.channel ?? "telegram", externalSenderId: overrides.externalSenderId ?? "telegram-user-1" },
    repository(candidates),
  );
}

test("resolves one valid Telegram context", async () => {
  const result = await resolve([baseCandidate]);
  assert.equal(result.outcome, "resolved");
  assert.deepEqual(result.context, {
    channel: "telegram",
    channelUserId: "channel-user-1",
    organizationId: "org-1",
    residentId: "resident-1",
    unitId: "unit-1",
    consorcioId: "building-1",
  });
});

test("returns unresolved for unknown or unbound Telegram users", async () => {
  assert.equal((await resolve([])).outcome, "unresolved");
  assert.equal((await resolve([{ ...baseCandidate, residentId: null, links: [] }])).outcome, "unresolved");
  assert.equal((await resolve([{ ...baseCandidate, links: [] }])).outcome, "unresolved");
});

test("rejects unsupported and malformed identity input before repository access", async () => {
  let calls = 0;
  const repo: BotIdentityRepository = {
    async findChannelCandidates() {
      calls += 1;
      return [];
    },
  };
  await assert.rejects(
    () => resolveBotContext({ channel: "whatsapp", externalSenderId: "user" }, repo),
    BotIdentityInputError,
  );
  await assert.rejects(
    () => resolveBotContext({ channel: "telegram", externalSenderId: " " }, repo),
    BotIdentityInputError,
  );
  assert.equal(calls, 0);
});

test("resolves WhatsApp only through a valid channel identity", async () => {
  let requestedChannel = "";
  let requestedSenderId = "";
  const result = await resolveBotContext(
    { channel: "whatsapp", externalSenderId: "5491123456789" },
    {
      async findChannelCandidates(channel, senderId) {
        requestedChannel = channel;
        requestedSenderId = senderId;
        return [baseCandidate];
      },
    },
  );
  assert.equal(result.outcome, "resolved");
  assert.equal(result.context?.channel, "whatsapp");
  assert.equal(requestedChannel, "whatsapp");
  assert.equal(requestedSenderId, "5491123456789");
});

test("returns blocked and inactive without constructing context", async () => {
  assert.equal((await resolve([{ ...baseCandidate, channelUserStatus: "blocked" }])).outcome, "blocked");
  assert.equal((await resolve([{ ...baseCandidate, channelUserStatus: "inactive" }])).outcome, "inactive");
  assert.equal((await resolve([{ ...baseCandidate, residentActive: false }])).outcome, "inactive");
  assert.equal((await resolve([{ ...baseCandidate, organizationStatus: "suspended" }])).outcome, "inactive");
});

test("returns ambiguous_unit for multiple active units in one organization", async () => {
  const candidate = {
    ...baseCandidate,
    links: [baseCandidate.links[0], { ...baseCandidate.links[0], unitId: "unit-2", consorcioId: "building-2" }],
  };
  const result = await resolve([candidate]);
  assert.equal(result.outcome, "ambiguous_unit");
  assert.equal(result.context, null);
});

test("returns ambiguous_organization for contexts across organizations", async () => {
  const result = await resolve([
    baseCandidate,
    {
      ...baseCandidate,
      channelUserId: "channel-user-2",
      organizationId: "org-2",
      residentOrganizationId: "org-2",
      links: [
        {
          ...baseCandidate.links[0],
          organizationId: "org-2",
          unitOrganizationId: "org-2",
          consorcioOrganizationId: "org-2",
        },
      ],
    },
  ]);
  assert.equal(result.outcome, "ambiguous_organization");
  assert.equal(result.context, null);
});

test("fails closed for cross-tenant relation inconsistencies", async () => {
  assert.equal((await resolve([{ ...baseCandidate, residentOrganizationId: "org-2" }])).outcome, "cross_tenant");
  assert.equal(
    (await resolve([{ ...baseCandidate, links: [{ ...baseCandidate.links[0], organizationId: "org-2" }] }])).outcome,
    "cross_tenant",
  );
  assert.equal(
    (await resolve([{ ...baseCandidate, links: [{ ...baseCandidate.links[0], unitOrganizationId: "org-2" }] }]))
      .outcome,
    "cross_tenant",
  );
  assert.equal(
    (await resolve([{ ...baseCandidate, links: [{ ...baseCandidate.links[0], consorcioOrganizationId: "org-2" }] }]))
      .outcome,
    "cross_tenant",
  );
});

test("repository failures fail closed and never produce a context", async () => {
  const repo = repository(async () => {
    throw new BotIdentityRepositoryError();
  });
  await assert.rejects(
    () => resolveBotContext({ channel: "telegram", externalSenderId: "telegram-user-1" }, repo),
    BotIdentityRepositoryError,
  );
});

test("does not accept inbound tenant selectors or hide ambiguity with LIMIT 1", async () => {
  const result = await resolveBotContext(
    {
      channel: "telegram",
      externalSenderId: "telegram-user-1",
      organizationId: "attacker-org",
      residentId: "attacker-resident",
      unitId: "attacker-unit",
    } as never,
    repository([
      baseCandidate,
      {
        ...baseCandidate,
        channelUserId: "channel-user-2",
        links: [{ ...baseCandidate.links[0], unitId: "unit-2", consorcioId: "building-2" }],
      },
    ]),
  );
  assert.equal(result.outcome, "ambiguous_unit");
  assert.equal(result.context, null);
});
