import type { BotUnitClarification } from "../../lib/bot-identity/identity-types";
import type { BotApiErrorCategory, BotApiOutcome, BotApiResponse, BotTicketResult } from "./api-types";

const SAFE_MESSAGES: Partial<Record<BotApiOutcome, string>> = {
  authentication_failed: "Authentication failed.",
  replay: "Authentication request already processed.",
  invalid_request: "Invalid request.",
  identity_unresolved: "Identity could not be resolved.",
  identity_blocked: "Identity is not available.",
  identity_inactive: "Identity is not available.",
  clarification_required: "Additional identity context is required.",
  cross_tenant: "Identity context is invalid.",
  capability_denied: "Capability is not authorized.",
  capability_not_ready: "Capability is not available yet.",
  idempotency_conflict: "The idempotency key was already used with different ticket data.",
  internal_error: "Request could not be completed.",
};

export function createApiResponse(
  outcome: BotApiOutcome,
  options: {
    correlationId?: string | null;
    capability?: string;
    retryable?: boolean;
    code?: string;
    category?: BotApiErrorCategory;
    status?: number;
    missingInput?: string[];
    result?: BotTicketResult;
    clarification?: BotUnitClarification;
  } = {},
): Response {
  const body: BotApiResponse = {
    apiVersion: "v1",
    correlationId: options.correlationId ?? null,
    capability: options.capability ?? "tickets.create",
    outcome,
    retryable: options.retryable ?? false,
    ...(options.missingInput ? { missingInput: options.missingInput } : {}),
    ...(SAFE_MESSAGES[outcome] ? { userSafeMessage: SAFE_MESSAGES[outcome] } : {}),
    ...(options.code || options.category
      ? {
          error: {
            code: options.code ?? outcome,
            category: options.category ?? "internal",
          },
        }
      : {}),
    ...(options.clarification ? { clarification: options.clarification } : {}),
    ...(options.result ? { result: options.result } : {}),
  };

  return Response.json(body, { status: options.status ?? statusForOutcome(outcome) });
}

function statusForOutcome(outcome: BotApiOutcome): number {
  switch (outcome) {
    case "authentication_failed":
    case "replay":
      return 401;
    case "capability_denied":
    case "identity_blocked":
    case "identity_inactive":
    case "cross_tenant":
      return 403;
    case "capability_not_ready":
      return 501;
    case "idempotency_conflict":
      return 409;
    case "internal_error":
      return 500;
    case "clarification_required":
    case "identity_unresolved":
    case "invalid_request":
      return 422;
    default:
      return 200;
  }
}
