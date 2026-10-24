import type { BotContext, BotIdentityChannel } from "../../lib/bot-identity/identity-types";
import type { AuthenticatedTechnicalPrincipal } from "../../lib/bot-security/security-types";

export const BOT_API_VERSION = "v1" as const;
export const BOT_API_CAPABILITY = "tickets.create" as const;

type BotApiCapability = typeof BOT_API_CAPABILITY;

type TicketsCreateApiInput = {
  ticketType: "reclamo" | "urgencia" | "consulta" | "pago";
  priority?: "alta" | "media" | "baja" | "normal";
  category?: string;
  description: string;
  clientReference?: string;
};

export type BotApiRequest = {
  apiVersion: typeof BOT_API_VERSION;
  correlationId: string;
  idempotencyKey: string;
  capability: BotApiCapability;
  source: {
    channel: BotIdentityChannel;
    externalSenderId: string;
    unitNumber?: string;
  };
  input: TicketsCreateApiInput;
};

export type BotApiOutcome =
  | "success"
  | "authentication_failed"
  | "replay"
  | "invalid_request"
  | "identity_unresolved"
  | "identity_blocked"
  | "identity_inactive"
  | "clarification_required"
  | "cross_tenant"
  | "capability_denied"
  | "capability_not_ready"
  | "idempotency_conflict"
  | "internal_error";

export type BotApiErrorCategory =
  | "transport"
  | "authentication"
  | "validation"
  | "identity"
  | "authorization"
  | "conflict"
  | "dependency"
  | "internal";

export type BotApiResponse = {
  apiVersion: typeof BOT_API_VERSION;
  correlationId: string | null;
  capability: string;
  outcome: BotApiOutcome;
  retryable: boolean;
  reference?: string;
  missingInput?: string[];
  userSafeMessage?: string;
  error?: {
    code: string;
    category: BotApiErrorCategory;
  };
  result?: { ticketId: string; ticketCode: string };
};

export type CapabilityAuthorizationInput = {
  principal: AuthenticatedTechnicalPrincipal;
  context: BotContext;
  capability: BotApiCapability;
};

export type CapabilityAuthorizationResult = { allowed: true } | { allowed: false; code: "capability_denied" };

export type CapabilityDispatchResult =
  | { outcome: "success"; retryable: false; result: { ticketId: string; ticketCode: string } }
  | { outcome: "idempotency_conflict"; retryable: false }
  | { outcome: "internal_error"; retryable: true };
