import type { SupabaseClient } from "@supabase/supabase-js";

import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

// Resend signs webhooks with Svix: HMAC-SHA256 of "id.timestamp.body" with the base64 key after "whsec_".
export function verifyResendSignature({
  body,
  id,
  timestamp,
  signature,
  secret,
  now = Date.now(),
}: {
  body: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  now?: number;
}) {
  if (!secret || !id || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  // The header can carry several "v1,<signature>" values separated by spaces; any match is valid.
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const received = Buffer.from(value, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

export type ResendEvent = {
  type: string;
  created_at: string;
  data?: {
    email_id?: string;
    bounce?: { message?: string };
    failed?: { reason?: string };
    suppressed?: { message?: string };
  };
};

const DELIVERY_BY_EVENT: Record<string, string> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.failed": "failed",
  "email.suppressed": "suppressed",
};

// Stores the outcome on the outbox row Resend's id points to. Emails that aren't in the outbox
// (the landing shares the Resend account) and older events than the stored one change nothing.
export async function recordResendEvent(admin: SupabaseClient, event: ResendEvent) {
  const deliveryStatus = DELIVERY_BY_EVENT[event.type];
  const emailId = event.data?.email_id;
  if (!deliveryStatus || !emailId || !event.created_at) return "ignored" as const;

  const detail = event.data?.bounce?.message ?? event.data?.failed?.reason ?? event.data?.suppressed?.message ?? null;
  const { error } = await admin
    .from("resident_email_outbox")
    .update({
      delivery_status: deliveryStatus,
      delivery_detail: detail?.slice(0, 500) ?? null,
      delivery_event_at: event.created_at,
    })
    .eq("provider_message_id", emailId)
    .or(`delivery_event_at.is.null,delivery_event_at.lt.${event.created_at}`);
  if (error) throw new Error(error.message);
  return "recorded" as const;
}
