import { createServerBotIdentityRepository } from "../../../../../../server/bot-identity/channel-identity-repository";
import { createServerPhoneBlacklistRepository } from "../../../../../../server/bot-message-access/phone-blacklist-repository";
import {
  handleMessageAccessRequest,
  messageAccessResponse,
} from "../../../../../../server/bot-message-access/request-handler";
import { createRuntimeBotKeyRegistry } from "../../../../../../server/bot-security/runtime-key-registry";
import { createSupabaseNonceReplayStore } from "../../../../../../server/bot-security/supabase-nonce-store";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (process.env.ELI_N8N_BOT_ENVIRONMENT !== "dev") {
    return messageAccessResponse({ decision: "unavailable", status: 503 });
  }
  try {
    return await handleMessageAccessRequest(request, {
      keyRegistry: createRuntimeBotKeyRegistry(),
      nonceStore: createSupabaseNonceReplayStore(),
      identityRepository: createServerBotIdentityRepository(),
      blacklistRepository: createServerPhoneBlacklistRepository(),
    });
  } catch {
    return messageAccessResponse({ decision: "unavailable", status: 503 });
  }
}
