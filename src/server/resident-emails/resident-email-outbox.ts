import type { SupabaseClient } from "@supabase/supabase-js";

import {
  type ResidentEmailPayload,
  type ResidentEmailTemplateKey,
  renderResidentEmail,
} from "./resident-email-templates";

type OutboxRow = {
  id: string;
  template_key: ResidentEmailTemplateKey;
  recipient_email: string;
  payload: ResidentEmailPayload;
  attempts: number;
  status: "pending" | "failed" | "sending";
  updated_at: string;
};

export type ResendConfig = { apiKey: string; from: string };

// Same gate as eli-landing: nothing is sent unless Resend is explicitly enabled.
export function resendConfigFromEnv(env: Record<string, string | undefined> = process.env): ResendConfig | null {
  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.RESEND_FROM?.trim();
  if (env.RESEND_ENABLED !== "true" || !apiKey || !from) return null;
  return { apiKey, from };
}

const RETRY_DELAY_MS = 5 * 60_000;
// After this many attempts a failed email stays failed and is not retried again.
export const MAX_ATTEMPTS = 5;
// A row left in "sending" this long belongs to a drain that died mid-send, so it is retried.
// Resend's Idempotency-Key keeps the retry from sending it twice.
const STUCK_SENDING_MS = 10 * 60_000;

// Sends the queued emails with Resend. Rows are claimed one by one (→ sending) only if they
// have not changed since they were read, so two drains running at the same time never send
// the same email.
export async function drainResidentEmailOutbox(
  admin: SupabaseClient,
  config: ResendConfig | null,
  send: typeof fetch = fetch,
  limit = 20,
) {
  if (!config) return { gate: "resend_configuration_required" as const, sent: 0 };

  const { data, error } = await admin
    .from("resident_email_outbox")
    .select("id, template_key, recipient_email, payload, attempts, status, updated_at")
    .or(
      `status.in.(pending,failed),and(status.eq.sending,updated_at.lt.${new Date(Date.now() - STUCK_SENDING_MS).toISOString()})`,
    )
    .lte("next_attempt_at", new Date().toISOString())
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let sent = 0;
  for (const row of (data ?? []) as OutboxRow[]) {
    const claim = await admin
      .from("resident_email_outbox")
      .update({ status: "sending", attempts: row.attempts + 1 })
      .eq("id", row.id)
      .eq("status", row.status)
      .eq("updated_at", row.updated_at)
      .select("id");
    if (claim.error) throw new Error(claim.error.message);
    if (!claim.data?.length) continue;

    try {
      const email = renderResidentEmail(row.template_key, row.payload);
      const response = await send("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `eli-resident-email-${row.id}`,
        },
        body: JSON.stringify({ from: config.from, to: [row.recipient_email], ...email }),
      });
      if (!response.ok) throw new Error(`resend_failed:${response.status}`);
      const result = (await response.json()) as { id?: string };
      await admin
        .from("resident_email_outbox")
        .update({
          status: "sent",
          provider_message_id: result.id ?? null,
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", row.id);
      sent += 1;
    } catch (sendError) {
      await admin
        .from("resident_email_outbox")
        .update({
          status: "failed",
          last_error: sendError instanceof Error ? sendError.message.slice(0, 500) : "resend_failed",
          next_attempt_at: new Date(Date.now() + RETRY_DELAY_MS * (row.attempts + 1)).toISOString(),
        })
        .eq("id", row.id);
    }
  }

  return { gate: "open" as const, sent };
}
