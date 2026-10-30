import type { BotContext } from "../../lib/bot-identity/identity-types";
import type { AuthenticatedTechnicalPrincipal } from "../../lib/bot-security/security-types";
import { createServerBotTicketPersistence } from "../tickets/bot-ticket-repository";
import { type BotTicketPersistence, executeCreateTicketCommand } from "../tickets/create-ticket-command";
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
    (context.channel === "telegram" || context.channel === "whatsapp") &&
      context.channelUserId &&
      context.organizationId &&
      context.residentId &&
      context.unitId &&
      context.consorcioId,
  );
}

export async function dispatchRegisteredCapability(
  input?: {
    request: import("./api-types").BotApiRequest;
    principal: AuthenticatedTechnicalPrincipal;
    context: BotContext;
  },
  botPersistence: BotTicketPersistence = createServerBotTicketPersistence(),
): Promise<import("./api-types").CapabilityDispatchResult> {
  if (!input) return { outcome: "internal_error", retryable: true };
  try {
    const result = await executeCreateTicketCommand(
      {
        actor: {
          kind: "bot",
          principal: input.principal,
          context: input.context,
          idempotencyKey: input.request.idempotencyKey,
          proposal: input.request.input,
          chatId: `${input.request.source.channel}:${input.request.source.externalSenderId}`,
        },
      },
      { botPersistence },
    );
    if (result.actor !== "bot") return { outcome: "internal_error", retryable: true };
    if (result.outcome === "conflict") return { outcome: "idempotency_conflict", retryable: false };
    const ticketResult = {
      ticketId: result.ticketId,
      ticketCode: result.ticketCode,
      ...(input.context.unitNumber ? { unitNumber: input.context.unitNumber } : {}),
      unitOrigin: input.context.unitOrigin,
    };
    if (result.outcome === "duplicate") return { outcome: "duplicate", retryable: false, result: ticketResult };
    return { outcome: "success" as const, retryable: false as const, result: ticketResult };
  } catch {
    return { outcome: "internal_error" as const, retryable: true as const };
  }
}
