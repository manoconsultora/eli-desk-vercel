import type { BotContext } from "../../lib/bot-identity/identity-types";
import { BOT_API_CAPABILITY, type CapabilityAuthorizationInput, type CapabilityAuthorizationResult } from "./api-types";

export function authorizeBotCapability(input: CapabilityAuthorizationInput): CapabilityAuthorizationResult {
  if (
    input.principal.name !== "integration:n8n" ||
    input.principal.principalId !== "n8n-bot-dev" ||
    input.principal.environment !== "dev" ||
    input.principal.tenantAuthority !== null ||
    input.principal.businessAuthority !== false ||
    input.capability !== BOT_API_CAPABILITY ||
    !hasCompleteContext(input.context)
  ) {
    return { allowed: false, code: "capability_denied" };
  }

  return { allowed: true };
}

function hasCompleteContext(context: BotContext): boolean {
  return Boolean(
    context.channel === "telegram" &&
      context.channelUserId &&
      context.organizationId &&
      context.residentId &&
      context.unitId &&
      context.consorcioId,
  );
}

export function dispatchRegisteredCapability(_input?: unknown) {
  return {
    outcome: "capability_not_ready" as const,
    retryable: false as const,
  };
}
