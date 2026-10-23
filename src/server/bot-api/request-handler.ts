import type { BotIdentityRepository, BotIdentityResolution } from "../../lib/bot-identity/identity-types";
import { type VerifySignedRequestInput, verifySignedRequest } from "../../lib/bot-security/hmac-verifier";
import type {
  AuthenticatedTechnicalPrincipal,
  BotKeyRegistry,
  BotSecurityEnvironment,
  NonceReplayStore,
} from "../../lib/bot-security/security-types";
import { BotIdentityInputError } from "../bot-identity/identity-errors";
import { resolveBotContext } from "../bot-identity/resolve-bot-context";
import { BotSecurityError } from "../bot-security/security-errors";
import { createApiResponse } from "./api-errors";
import {
  BOT_API_CAPABILITY,
  BOT_API_VERSION,
  type BotApiRequest,
  type CapabilityAuthorizationResult,
  type CapabilityDispatchResult,
} from "./api-types";
import { type RawBodyError, readBoundedRawBody } from "./raw-body";

type Verify = (input: VerifySignedRequestInput) => Promise<AuthenticatedTechnicalPrincipal>;

export const BOT_HMAC_DOMAIN = "ELI-N8N-BOT-API-V1";

export type BotApiHandlerDependencies = {
  environment: BotSecurityEnvironment;
  keyRegistry: BotKeyRegistry;
  nonceStore: NonceReplayStore;
  identityRepository: BotIdentityRepository;
  authorize: (input: {
    principal: AuthenticatedTechnicalPrincipal;
    context: NonNullable<BotIdentityResolution["context"]>;
    capability: typeof BOT_API_CAPABILITY;
  }) => CapabilityAuthorizationResult;
  dispatch: (input: {
    request: BotApiRequest;
    principal: AuthenticatedTechnicalPrincipal;
    context: NonNullable<BotIdentityResolution["context"]>;
  }) => CapabilityDispatchResult | PromiseLike<CapabilityDispatchResult>;
  verify?: Verify;
  readBody?: (request: Request) => Promise<Uint8Array>;
};

export async function handleBotApiRequest(
  request: Request,
  dependencies: BotApiHandlerDependencies,
): Promise<Response> {
  let rawBody: Uint8Array;
  try {
    rawBody = await (dependencies.readBody ?? readBoundedRawBody)(request);
  } catch (error) {
    return responseForRawBodyError(error);
  }
  const path = new URL(request.url).pathname;
  const verify = dependencies.verify ?? verifySignedRequest;

  let principal: AuthenticatedTechnicalPrincipal;
  try {
    principal = await verify({
      domain: BOT_HMAC_DOMAIN,
      method: request.method,
      path,
      rawBody,
      headers: request.headers,
      environment: dependencies.environment,
      keyRegistry: dependencies.keyRegistry,
      nonceStore: dependencies.nonceStore,
    });
  } catch (error) {
    if (error instanceof BotSecurityError && error.code === "nonce_replay") {
      return createApiResponse("replay", { code: "nonce_replay", category: "authentication" });
    }
    return createApiResponse("authentication_failed", { code: "authentication_failed", category: "authentication" });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return createApiResponse("invalid_request", { code: "malformed_json", category: "validation" });
  }

  const parsed = validateRequest(payload);
  if (!parsed.ok) {
    return createApiResponse("invalid_request", {
      correlationId: parsed.correlationId,
      code: parsed.code,
      category: "validation",
      missingInput: parsed.missingInput,
    });
  }

  let identity: BotIdentityResolution;
  try {
    identity = await resolveBotContext(parsed.request.source, dependencies.identityRepository);
  } catch (error) {
    if (error instanceof BotIdentityInputError) {
      return createApiResponse("invalid_request", {
        correlationId: parsed.request.correlationId,
        code: "invalid_identity_input",
        category: "validation",
      });
    }
    return createApiResponse("internal_error", {
      correlationId: parsed.request.correlationId,
      code: "identity_resolution_failed",
      category: "dependency",
      retryable: true,
    });
  }

  const identityResponse = responseForIdentity(identity, parsed.request.correlationId);
  if (identityResponse) return identityResponse;
  if (!identity.context) {
    return createApiResponse("internal_error", {
      correlationId: parsed.request.correlationId,
      code: "missing_identity_context",
      category: "internal",
    });
  }

  const authorization = dependencies.authorize({
    principal,
    context: identity.context,
    capability: BOT_API_CAPABILITY,
  });
  if (!authorization.allowed) {
    return createApiResponse("capability_denied", {
      correlationId: parsed.request.correlationId,
      code: authorization.code,
      category: "authorization",
    });
  }

  const dispatched = await dependencies.dispatch({
    request: parsed.request,
    principal,
    context: identity.context,
  });
  return createApiResponse(dispatched.outcome, {
    correlationId: parsed.request.correlationId,
    ...(dispatched.outcome === "success" ? {} : { code: dispatched.outcome, category: "dependency" as const }),
    retryable: dispatched.retryable,
    ...(dispatched.outcome === "success" ? { result: dispatched.result } : {}),
  });
}

function responseForRawBodyError(error: unknown): Response {
  const code = (error as RawBodyError)?.code;
  switch (code) {
    case "unsupported_method":
      return createApiResponse("invalid_request", { code, category: "transport", status: 405 });
    case "unsupported_content_type":
      return createApiResponse("invalid_request", { code, category: "transport", status: 415 });
    case "payload_too_large":
      return createApiResponse("invalid_request", { code, category: "transport", status: 413 });
    case "request_timeout":
      return createApiResponse("invalid_request", { code, category: "transport", status: 408, retryable: true });
    default:
      return createApiResponse("invalid_request", { code: "body_read_failed", category: "transport" });
  }
}

function responseForIdentity(identity: BotIdentityResolution, correlationId: string): Response | null {
  switch (identity.outcome) {
    case "resolved":
      return null;
    case "blocked":
      return createApiResponse("identity_blocked", { correlationId, code: "identity_blocked", category: "identity" });
    case "inactive":
      return createApiResponse("identity_inactive", { correlationId, code: "identity_inactive", category: "identity" });
    case "ambiguous_unit":
    case "ambiguous_organization":
      return createApiResponse("clarification_required", {
        correlationId,
        code: identity.outcome,
        category: "identity",
      });
    case "cross_tenant":
      return createApiResponse("cross_tenant", { correlationId, code: "cross_tenant", category: "identity" });
    case "unresolved":
      return createApiResponse("identity_unresolved", {
        correlationId,
        code: "identity_unresolved",
        category: "identity",
      });
  }
}

type ValidationResult =
  | { ok: true; request: BotApiRequest }
  | { ok: false; code: string; correlationId?: string | null; missingInput?: string[] };

function validateRequest(value: unknown): ValidationResult {
  if (!isRecord(value)) return { ok: false, code: "invalid_envelope" };
  const correlationId = stringField(value.correlationId);
  if (!correlationId) return { ok: false, code: "missing_correlation_id" };
  if (
    hasUnexpectedKeys(value, [
      "apiVersion",
      "correlationId",
      "idempotencyKey",
      "capability",
      "source",
      "input",
      "requestId",
    ])
  ) {
    return { ok: false, code: "unexpected_authority_field", correlationId };
  }
  if ("requestId" in value) return { ok: false, code: "body_request_id_not_allowed", correlationId };
  if (value.apiVersion !== BOT_API_VERSION) return { ok: false, code: "unsupported_api_version", correlationId };
  if (value.capability !== BOT_API_CAPABILITY) return { ok: false, code: "unsupported_capability", correlationId };
  if (!stringField(value.idempotencyKey)) return { ok: false, code: "missing_idempotency_key", correlationId };
  if (!isRecord(value.source)) return { ok: false, code: "invalid_source", correlationId };
  if (hasUnexpectedKeys(value.source, ["channel", "externalSenderId"])) {
    return { ok: false, code: "invalid_source", correlationId };
  }
  if (
    !isOneOf(value.source.channel, ["telegram", "whatsapp"] as const) ||
    !stringField(value.source.externalSenderId)
  ) {
    return { ok: false, code: "invalid_source", correlationId };
  }
  if (!isRecord(value.input)) return { ok: false, code: "invalid_input", correlationId };
  if (hasUnexpectedKeys(value.input, ["ticketType", "priority", "category", "description", "clientReference"])) {
    return { ok: false, code: "unexpected_input_field", correlationId };
  }
  if (
    !isOneOf(value.input.ticketType, ["reclamo", "urgencia", "consulta", "pago"] as const) ||
    !stringField(value.input.description)
  ) {
    return { ok: false, code: "missing_ticket_input", correlationId };
  }
  if (
    value.input.priority !== undefined &&
    !isOneOf(value.input.priority, ["alta", "media", "baja", "normal"] as const)
  ) {
    return { ok: false, code: "invalid_priority", correlationId };
  }
  if (value.input.category !== undefined && typeof value.input.category !== "string") {
    return { ok: false, code: "invalid_category", correlationId };
  }
  if (value.input.clientReference !== undefined && typeof value.input.clientReference !== "string") {
    return { ok: false, code: "invalid_client_reference", correlationId };
  }
  return { ok: true, request: value as unknown as BotApiRequest };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512 ? value : null;
}

function hasUnexpectedKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).some((key) => !allowed.includes(key));
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}
