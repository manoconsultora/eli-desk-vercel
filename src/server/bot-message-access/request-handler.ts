import type { BotIdentityCandidate, BotIdentityRepository } from "../../lib/bot-identity/identity-types";
import { verifySignedRequest } from "../../lib/bot-security/hmac-verifier";
import type {
  AuthenticatedTechnicalPrincipal,
  BotKeyRegistry,
  NonceReplayStore,
} from "../../lib/bot-security/security-types";
import { RawBodyError, readBoundedRawBody } from "../bot-api/raw-body";
import { BotSecurityError } from "../bot-security/security-errors";
import type { PhoneBlacklistRepository } from "./phone-blacklist-repository";

type AccessRequest = {
  apiVersion: "v1";
  capability: "messages.authorize";
  correlationId: string;
  source: { channel: "whatsapp"; externalSenderId: string };
};

type AccessDependencies = {
  keyRegistry: BotKeyRegistry;
  nonceStore: NonceReplayStore;
  identityRepository: BotIdentityRepository;
  blacklistRepository: PhoneBlacklistRepository;
};

export function messageAccessResponse(input: {
  decision: "allowed" | "blocked" | "unavailable";
  correlationId?: string | null;
  status?: number;
}): Response {
  return Response.json(
    {
      apiVersion: "v1",
      capability: "messages.authorize",
      correlationId: input.correlationId ?? null,
      decision: input.decision,
    },
    { status: input.status ?? 200, headers: { "cache-control": "no-store, private" } },
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRequest(value: unknown): AccessRequest | null {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !["apiVersion", "capability", "correlationId", "source"].includes(key)) ||
    value.apiVersion !== "v1" ||
    value.capability !== "messages.authorize" ||
    typeof value.correlationId !== "string" ||
    !value.correlationId.trim() ||
    value.correlationId.length > 256 ||
    !isRecord(value.source) ||
    Object.keys(value.source).some((key) => !["channel", "externalSenderId"].includes(key)) ||
    value.source.channel !== "whatsapp" ||
    typeof value.source.externalSenderId !== "string" ||
    !/^\d{8,15}$/.test(value.source.externalSenderId)
  )
    return null;
  return value as unknown as AccessRequest;
}

function authorizedPrincipal(principal: AuthenticatedTechnicalPrincipal): boolean {
  return (
    principal.kind === "technical_integration" &&
    principal.name === "integration:n8n" &&
    principal.principalId === "n8n-bot-dev" &&
    principal.environment === "dev" &&
    principal.tenantAuthority === null &&
    principal.businessAuthority === false
  );
}

function hasVerifiedOrganization(candidate: BotIdentityCandidate): boolean {
  return Boolean(
    candidate.channelUserId &&
      candidate.channelUserStatus === "active" &&
      candidate.organizationId &&
      candidate.organizationStatus === "active" &&
      candidate.residentId &&
      candidate.residentActive === true &&
      candidate.residentOrganizationId === candidate.organizationId &&
      candidate.links.length > 0 &&
      candidate.links.every(
        (link) =>
          link.unitId &&
          link.consorcioId &&
          link.organizationId === candidate.organizationId &&
          link.unitOrganizationId === candidate.organizationId &&
          link.consorcioOrganizationId === candidate.organizationId,
      ),
  );
}

export async function handleMessageAccessRequest(
  request: Request,
  dependencies: AccessDependencies,
): Promise<Response> {
  let rawBody: Uint8Array;
  try {
    rawBody = await readBoundedRawBody(request);
  } catch (error) {
    const status = error instanceof RawBodyError && error.code === "payload_too_large" ? 413 : 400;
    return messageAccessResponse({ decision: "unavailable", status });
  }

  let principal: AuthenticatedTechnicalPrincipal;
  try {
    principal = await verifySignedRequest({
      domain: "ELI-N8N-BOT-API-V1",
      method: request.method,
      path: new URL(request.url).pathname,
      rawBody,
      headers: request.headers,
      environment: "dev",
      keyRegistry: dependencies.keyRegistry,
      nonceStore: dependencies.nonceStore,
    });
  } catch (error) {
    const status = error instanceof BotSecurityError && error.code === "nonce_replay" ? 409 : 401;
    return messageAccessResponse({ decision: "unavailable", status });
  }
  if (!authorizedPrincipal(principal)) return messageAccessResponse({ decision: "unavailable", status: 403 });

  let parsed: AccessRequest | null;
  try {
    parsed = parseRequest(JSON.parse(new TextDecoder().decode(rawBody)));
  } catch {
    parsed = null;
  }
  if (!parsed) return messageAccessResponse({ decision: "unavailable", status: 422 });

  try {
    const candidates = await dependencies.identityRepository.findChannelCandidates(
      "whatsapp",
      parsed.source.externalSenderId,
    );
    // The scope is derived from the authenticated sender's verified relation.
    // 1A and 4B in one organization are valid here; no unit is selected or mutated.
    if (candidates.length !== 1 || !hasVerifiedOrganization(candidates[0])) {
      return messageAccessResponse({ decision: "unavailable", correlationId: parsed.correlationId, status: 503 });
    }
    const blocked = await dependencies.blacklistRepository.isPhoneBlocked({
      organizationId: candidates[0].organizationId,
      phoneDigits: parsed.source.externalSenderId,
    });
    if (typeof blocked !== "boolean") throw new Error("Blacklist result is unavailable.");
    return messageAccessResponse({ decision: blocked ? "blocked" : "allowed", correlationId: parsed.correlationId });
  } catch {
    return messageAccessResponse({ decision: "unavailable", correlationId: parsed.correlationId, status: 503 });
  }
}
