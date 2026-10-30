import type { BotIdentityCandidate, BotIdentityRepository } from "../../lib/bot-identity/identity-types";
import { canonicalUnitNumber, shortConsorcioLabel } from "../../lib/bot-identity/unit-number";
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
      unitNumber: "1A",
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
    unitNumber: "1A",
    consorcioId: "building-1",
    consorcioLabel: "",
    unitOrigin: "inferred_single_link",
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

test("selects one explicitly requested active linked unit without removing other links", async () => {
  const candidate = {
    ...baseCandidate,
    links: [baseCandidate.links[0], { ...baseCandidate.links[0], unitId: "unit-2", unitNumber: "4B" }],
  };
  const result = await resolveBotContext(
    { channel: "telegram", externalSenderId: "telegram-user-1", unitNumber: "4B" },
    repository([candidate]),
  );
  assert.equal(result.outcome, "resolved");
  assert.equal(result.context?.unitId, "unit-2");
  assert.equal(candidate.links.length, 2);
});

test("rejects an explicitly selected unit that is not actively linked", async () => {
  const result = await resolveBotContext(
    { channel: "telegram", externalSenderId: "telegram-user-1", unitNumber: "attacker-unit" },
    repository([baseCandidate]),
  );
  assert.equal(result.outcome, "invalid_unit_selection");
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

test("rejects an unlinked inbound unit selector instead of hiding identity ambiguity", async () => {
  const result = await resolveBotContext(
    {
      channel: "telegram",
      externalSenderId: "telegram-user-1",
      organizationId: "attacker-org",
      residentId: "attacker-resident",
      unitId: "attacker-unit",
      unitNumber: "attacker-unit",
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
  assert.equal(result.outcome, "invalid_unit_selection");
  assert.equal(result.context, null);
});

function link(unitId: string, unitNumber: string, consorcio: { id: string; label: string }) {
  const organizationId = "org-1";
  return {
    organizationId,
    unitId,
    unitNumber,
    unitOrganizationId: organizationId,
    consorcioId: consorcio.id,
    consorcioOrganizationId: organizationId,
    consorcioLabel: consorcio.label,
  };
}

function ask(candidate: BotIdentityCandidate, unitNumber?: string) {
  return resolveBotContext(
    { channel: "telegram", externalSenderId: "telegram-user-1", unitNumber },
    repository([candidate]),
  );
}

test("single link without a named unit is deduced and marked inferred_single_link", async () => {
  const result = await ask({
    ...baseCandidate,
    links: [link("unit-1", "3B", { id: "building-1", label: "Torre Norte" })],
  });
  assert.equal(result.outcome, "resolved");
  assert.equal(result.context?.unitOrigin, "inferred_single_link");
  assert.equal(result.context?.consorcioLabel, "Torre Norte");
});

test("a named unit is marked provided even when it is the only link", async () => {
  const result = await ask(
    { ...baseCandidate, links: [link("unit-1", "3B", { id: "building-1", label: "Torre Norte" })] },
    "3b",
  );
  assert.equal(result.outcome, "resolved");
  assert.equal(result.context?.unitOrigin, "provided");
});

test("several units without a named unit require clarification with unit options and no ids", async () => {
  const result = await ask({
    ...baseCandidate,
    links: [
      link("unit-1", "3B", { id: "building-1", label: "Torre Norte" }),
      link("unit-2", "3B", { id: "building-2", label: "Edificio Sur" }),
    ],
  });
  assert.equal(result.outcome, "ambiguous_unit");
  assert.equal(result.context, null);
  assert.deepEqual(result.clarification, {
    kind: "unit",
    unitOptions: [
      { unitNumber: "3B", consorcioLabel: "Torre Norte" },
      { unitNumber: "3B", consorcioLabel: "Edificio Sur" },
    ],
  });
  assert.doesNotMatch(JSON.stringify(result.clarification), /unit-|building-|org-|resident/);
});

test("invalid unit selection returns the resident's own options", async () => {
  const result = await ask(
    { ...baseCandidate, links: [link("unit-1", "3B", { id: "building-1", label: "Torre Norte" })] },
    "99Z",
  );
  assert.equal(result.outcome, "invalid_unit_selection");
  assert.deepEqual(result.clarification?.unitOptions, [{ unitNumber: "3B", consorcioLabel: "Torre Norte" }]);
});

test("clarification lists at most five options", async () => {
  const links = ["1", "2", "3", "4", "5", "6", "7"].map((n) =>
    link(`unit-${n}`, n, { id: `building-${n}`, label: `C${n}` }),
  );
  const result = await ask({ ...baseCandidate, links });
  assert.equal(result.clarification?.unitOptions.length, 5);
});

test("repeated numbering across consorcios is disambiguated by consorcio label in the answer", async () => {
  const candidate = {
    ...baseCandidate,
    links: [
      link("unit-1", "A", { id: "building-1", label: "Torre Norte" }),
      link("unit-2", "A", { id: "building-2", label: "Edificio Sur" }),
    ],
  };
  const ambiguous = await ask(candidate, "a");
  assert.equal(ambiguous.outcome, "ambiguous_unit");
  const picked = await ask(candidate, "A - Edificio Sur");
  assert.equal(picked.outcome, "resolved");
  assert.equal(picked.context?.unitId, "unit-2");
  assert.equal(picked.context?.unitOrigin, "provided");
});

test("single-character unit does not match as a prefix or substring of longer numbers", async () => {
  const candidate = {
    ...baseCandidate,
    links: [
      link("unit-1", "AB", { id: "building-1", label: "N" }),
      link("unit-2", "B", { id: "building-1", label: "N" }),
    ],
  };
  const result = await ask(candidate, "B");
  assert.equal(result.outcome, "resolved");
  assert.equal(result.context?.unitId, "unit-2");
});

test("unit numbers are compared canonically", async () => {
  assert.equal(canonicalUnitNumber("Depto. 4º-B"), "4b");
  assert.equal(canonicalUnitNumber("Piso 1 Dto A"), "1a");
  assert.equal(canonicalUnitNumber("Unidad 12"), "12");
  assert.equal(canonicalUnitNumber("Ｔ３ ª"), "t3");
  const result = await ask(
    { ...baseCandidate, links: [link("unit-1", "4B", { id: "building-1", label: "N" })] },
    "dpto 4 º b",
  );
  assert.equal(result.outcome, "resolved");
});

test("a selector with no usable characters is an invalid selection, never a silent deduction", async () => {
  const result = await ask(
    { ...baseCandidate, links: [link("unit-1", "4B", { id: "building-1", label: "N" })] },
    "...",
  );
  assert.equal(result.outcome, "invalid_unit_selection");
});

test("ambiguous_organization never lists options", async () => {
  const other = {
    ...baseCandidate,
    channelUserId: "channel-user-2",
    organizationId: "org-2",
    residentOrganizationId: "org-2",
    links: [
      {
        ...link("unit-9", "9", { id: "building-9", label: "Otro" }),
        organizationId: "org-2",
        unitOrganizationId: "org-2",
        consorcioOrganizationId: "org-2",
      },
    ],
  };
  const result = await resolve([baseCandidate, other]);
  assert.equal(result.outcome, "ambiguous_organization");
  assert.equal(result.clarification, undefined);
});

test("consorcio labels are truncated to a short name", () => {
  assert.equal(shortConsorcioLabel("Consorcio de Propietarios Avenida Libertador 1234").length, 24);
  assert.equal(shortConsorcioLabel(null), "");
  assert.equal(shortConsorcioLabel("  Torre   Norte "), "Torre Norte");
});
