import "server-only";

import type { BotHmacKey, BotKeyRegistry, BotSecurityEnvironment } from "../../lib/bot-security/security-types";
import { parseRuntimeKeys } from "./runtime-key-parser";

const PRINCIPAL_ID = "n8n-bot-dev";
const KEY_CONFIG_ENV = "ELI_N8N_BOT_HMAC_KEYS_JSON";

export class RuntimeBotKeyRegistry implements BotKeyRegistry {
  async resolve(keyId: string, environment: BotSecurityEnvironment): Promise<BotHmacKey | null> {
    const key = parseRuntimeKeys(process.env[KEY_CONFIG_ENV], PRINCIPAL_ID)?.find(
      (candidate) => candidate.keyId === keyId && candidate.environment === environment,
    );
    return key ?? null;
  }
}

export function createRuntimeBotKeyRegistry(): BotKeyRegistry {
  return new RuntimeBotKeyRegistry();
}
