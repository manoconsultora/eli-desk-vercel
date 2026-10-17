import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { NonceReplayStore, NonceReservation, NonceReservationResult } from "../../lib/bot-security/security-types";

class SupabaseNonceReplayStore implements NonceReplayStore {
  async reserve(input: NonceReservation): Promise<NonceReservationResult> {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secretKey) throw new Error("Nonce runtime configuration is unavailable.");

    const client = createClient(url, secretKey);
    const { data, error } = await client.rpc("reserve_n8n_hmac_nonce", {
      p_environment: input.environment,
      p_key_id: input.keyId,
      p_nonce: input.nonce,
      p_request_id: input.requestId,
    });

    if (error) throw new Error("Nonce reservation failed.");
    if (typeof data !== "boolean") throw new Error("Nonce reservation returned an invalid result.");
    return data ? "reserved" : "replay";
  }
}

export function createSupabaseNonceReplayStore(): NonceReplayStore {
  return new SupabaseNonceReplayStore();
}
