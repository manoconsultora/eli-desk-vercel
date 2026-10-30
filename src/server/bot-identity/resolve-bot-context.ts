import type {
  BotContext,
  BotIdentityCandidate,
  BotIdentityChannel,
  BotIdentityInput,
  BotIdentityRepository,
  BotIdentityResolution,
  BotUnitClarification,
} from "../../lib/bot-identity/identity-types";
import { canonicalUnitNumber, MAX_UNIT_OPTIONS, shortConsorcioLabel } from "../../lib/bot-identity/unit-number";
import { BotIdentityInputError } from "./identity-errors";

const TELEGRAM_SENDER_ID = /^[^\s]{1,256}$/;
const WHATSAPP_SENDER_ID = /^\d{8,15}$/;

function isValidSenderId(channel: string, externalSenderId: string): channel is BotIdentityChannel {
  if (channel === "telegram") return TELEGRAM_SENDER_ID.test(externalSenderId);
  if (channel === "whatsapp") return WHATSAPP_SENDER_ID.test(externalSenderId);
  return false;
}

function isTenantMismatch(candidate: BotIdentityCandidate): boolean {
  if (candidate.residentOrganizationId !== null && candidate.residentOrganizationId !== candidate.organizationId) {
    return true;
  }
  return candidate.links.some(
    (link) =>
      link.organizationId !== candidate.organizationId ||
      link.unitOrganizationId !== candidate.organizationId ||
      link.consorcioOrganizationId !== candidate.organizationId ||
      link.consorcioId === null ||
      link.unitOrganizationId === null,
  );
}

function hasInactiveRelation(candidate: BotIdentityCandidate): boolean {
  return candidate.organizationStatus !== "active" || candidate.residentActive === false;
}

function resolvedContexts(candidates: BotIdentityCandidate[], channel: BotIdentityChannel): BotContext[] {
  return candidates.flatMap((candidate) =>
    candidate.links.flatMap((link) =>
      candidate.residentId && link.consorcioId
        ? [
            {
              channel,
              channelUserId: candidate.channelUserId,
              organizationId: candidate.organizationId,
              residentId: candidate.residentId,
              unitId: link.unitId,
              unitNumber: link.unitNumber ?? undefined,
              consorcioId: link.consorcioId,
              consorcioLabel: shortConsorcioLabel(link.consorcioLabel),
              unitOrigin: "inferred_single_link" as const,
            },
          ]
        : [],
    ),
  );
}

function withoutDuplicateContexts(contexts: BotContext[]): BotContext[] {
  const seen = new Set<string>();
  return contexts.filter((context) => {
    const key = [
      context.channelUserId,
      context.organizationId,
      context.residentId,
      context.unitId,
      context.consorcioId,
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function resolveBotContext(
  input: BotIdentityInput,
  repository: BotIdentityRepository,
): Promise<BotIdentityResolution> {
  if (!isValidSenderId(input.channel, input.externalSenderId)) {
    throw new BotIdentityInputError();
  }

  const candidates = await repository.findChannelCandidates(input.channel, input.externalSenderId);
  if (candidates.some((candidate) => candidate.channelUserStatus === "blocked")) {
    return { outcome: "blocked", context: null };
  }
  if (candidates.length === 0) return { outcome: "unresolved", context: null };
  if (candidates.some((candidate) => isTenantMismatch(candidate))) {
    return { outcome: "cross_tenant", context: null };
  }
  if (candidates.some((candidate) => candidate.channelUserStatus === "inactive" || hasInactiveRelation(candidate))) {
    return { outcome: "inactive", context: null };
  }

  const contexts = withoutDuplicateContexts(resolvedContexts(candidates, input.channel));
  if (contexts.length === 0) return { outcome: "unresolved", context: null };

  const organizationIds = new Set(contexts.map((context) => context.organizationId));
  if (organizationIds.size > 1) return { outcome: "ambiguous_organization", context: null };
  const unitRequested = input.unitNumber !== undefined && input.unitNumber.trim().length > 0;
  const requestedUnitNumber = unitRequested ? canonicalUnitNumber(input.unitNumber ?? "") : "";
  const selectedContexts = unitRequested
    ? contexts.filter((context) => requestedUnitNumber !== "" && matchesRequestedUnit(context, requestedUnitNumber))
    : contexts;
  if (unitRequested && selectedContexts.length === 0) {
    return { outcome: "invalid_unit_selection", context: null, clarification: unitClarification(contexts) };
  }
  if (selectedContexts.length > 1) {
    return { outcome: "ambiguous_unit", context: null, clarification: unitClarification(contexts) };
  }
  const selected = selectedContexts[0];
  return {
    outcome: "resolved",
    context: { ...selected, unitOrigin: unitRequested ? "provided" : "inferred_single_link" },
  };
}

function matchesRequestedUnit(context: BotContext, requested: string): boolean {
  const number = canonicalUnitNumber(context.unitNumber ?? "");
  if (!number) return false;
  if (requested === number) return true;
  // The resident may answer with the option text, e.g. "3B Torre Norte", to pick between repeated numbers.
  const label = canonicalUnitNumber(context.consorcioLabel ?? "");
  return label.length > 0 && (requested === `${number}${label}` || requested === `${label}${number}`);
}

function unitClarification(contexts: BotContext[]): BotUnitClarification {
  const options = contexts
    .filter((context) => (context.unitNumber ?? "").trim().length > 0)
    .map((context) => ({
      key: `${context.consorcioId}:${canonicalUnitNumber(context.unitNumber ?? "")}`,
      unitNumber: (context.unitNumber ?? "").trim(),
      consorcioLabel: context.consorcioLabel ?? "",
    }))
    .filter((option, index, all) => all.findIndex((other) => other.key === option.key) === index)
    .slice(0, MAX_UNIT_OPTIONS)
    .map(({ unitNumber, consorcioLabel }) => ({ unitNumber, consorcioLabel }));
  return { kind: "unit", unitOptions: options };
}
