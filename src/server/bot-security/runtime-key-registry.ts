import "server-only";

import type { BotHmacKey, BotKeyRegistry, BotSecurityEnvironment } from "../../lib/bot-security/security-types";

const PRINCIPAL_ID = "n8n-bot-dev";
const KEY_CONFIG_ENV = "ELI_N8N_BOT_HMAC_KEYS_JSON";
const ALLOWED_FIELDS = new Set(["keyId", "environment", "state", "secret", "principalId", "validUntil"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function parseRuntimeKeys(raw: string | undefined): BotHmacKey[] | null {
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
  // biome-ignore lint/plugin: rechaza el registro completo en la primera key inválida o repetida
  for (const value of parsed) {
    if (!isRecord(value) || Object.keys(value).some((field) => !ALLOWED_FIELDS.has(field))) return null;
    if (
      !nonEmptyString(value.keyId) ||
      !nonEmptyString(value.environment) ||
      !nonEmptyString(value.state) ||
      !nonEmptyString(value.secret) ||
      value.principalId !== PRINCIPAL_ID ||
      !["dev", "prod"].includes(value.environment) ||
      !["active", "retiring", "revoked"].includes(value.state) ||
      keyIds.has(value.keyId)
    ) {
      return null;
    }
    if (value.state === "retiring") {
      if (typeof value.validUntil !== "number" || !Number.isSafeInteger(value.validUntil) || value.validUntil < 0) {
        return null;
      }
    } else if (value.validUntil !== undefined) {
      return null;
    }
    keyIds.add(value.keyId);
    keys.push({
      keyId: value.keyId,
      environment: value.environment as BotSecurityEnvironment,
      state: value.state as BotHmacKey["state"],
      secret: value.secret,
      principalId: PRINCIPAL_ID,
      ...(value.validUntil !== undefined ? { validUntil: value.validUntil } : {}),
    });
  }
  return keys;
}

export class RuntimeBotKeyRegistry implements BotKeyRegistry {
  async resolve(keyId: string, environment: BotSecurityEnvironment): Promise<BotHmacKey | null> {
    const key = parseRuntimeKeys(process.env[KEY_CONFIG_ENV])?.find(
      (candidate) => candidate.keyId === keyId && candidate.environment === environment,
    );
    return key ?? null;
  }
}

export function createRuntimeBotKeyRegistry(): BotKeyRegistry {
  return new RuntimeBotKeyRegistry();
}
