import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type PhoneBlacklistRepository = {
  isPhoneBlocked(input: { organizationId: string; phoneDigits: string }): Promise<boolean>;
};

export function createPhoneBlacklistRepository(client: SupabaseClient): PhoneBlacklistRepository {
  return {
    async isPhoneBlocked({ organizationId, phoneDigits }) {
      if (!organizationId || !/^\d{8,15}$/.test(phoneDigits)) throw new Error("Blacklist scope is unavailable.");
      // Same table and active organization scope as Desk listBlacklist / Join.
      // No building filter: a contact is blocked for the whole administration.
      const { data, error } = await client
        .from("resident_blacklist")
        .select("id, phone_digits")
        .eq("organization_id", organizationId)
        .is("removed_at", null)
        .eq("phone_digits", phoneDigits)
        .limit(1);
      if (
        error ||
        !Array.isArray(data) ||
        data.some((row) => typeof row?.id !== "string" || !row.id || row.phone_digits !== phoneDigits)
      ) {
        throw new Error("Blacklist query is unavailable.");
      }
      return data.length > 0;
    },
  };
}

export function createServerPhoneBlacklistRepository(): PhoneBlacklistRepository {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Blacklist runtime configuration is unavailable.");
  return createPhoneBlacklistRepository(createClient(url, serviceRoleKey));
}
