import type { BotHmacKey, BotSecurityEnvironment } from "../../lib/bot-security/security-types";

const ALLOWED_FIELDS = new Set(["keyId", "environment", "state", "secret", "principalId", "validUntil"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export function parseRuntimeKeys(raw: string | undefined, trustedPrincipalId: string): BotHmacKey[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const keys: BotHmacKey[] = [];
  const keyIds = new Set<string>();
  for (const value of parsed) {
    if (!isRecord(value) || Object.keys(value).some((field) => !ALLOWED_FIELDS.has(field))) return null;
    if (
      !nonEmptyString(value.keyId) ||
      !nonEmptyString(value.environment) ||
      !nonEmptyString(value.state) ||
      !nonEmptyString(value.secret) ||
      value.principalId !== trustedPrincipalId ||
      !["dev", "prod"].includes(value.environment) ||
      !["active", "retiring", "revoked"].includes(value.state) ||
      keyIds.has(value.keyId)
    ) {
      return null;
    }
    if (
      (value.state === "retiring" &&
        (typeof value.validUntil !== "number" || !Number.isSafeInteger(value.validUntil) || value.validUntil < 0)) ||
      (value.state !== "retiring" && value.validUntil !== undefined)
    ) {
      return null;
    }
    keyIds.add(value.keyId);
    keys.push({
      keyId: value.keyId,
      environment: value.environment as BotSecurityEnvironment,
      state: value.state as BotHmacKey["state"],
      secret: value.secret,
      principalId: trustedPrincipalId,
      ...(value.validUntil !== undefined ? { validUntil: value.validUntil as number } : {}),
    });
  }
  return keys;
}
