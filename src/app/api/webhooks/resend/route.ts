import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { type ResendEvent, recordResendEvent, verifyResendSignature } from "@/server/resident-emails/resend-webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Resend reports whether each email was delivered, bounced, failed or suppressed.
export async function POST(request: Request) {
  // The signature covers the raw body, so it is read as text before parsing.
  const body = await request.text();
  const verified = verifyResendSignature({
    body,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    secret: process.env.RESEND_WEBHOOK_SECRET ?? "",
  });
  if (!verified) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const result = await recordResendEvent(supabaseAdmin, JSON.parse(body) as ResendEvent);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    // A 500 makes Resend retry the event later.
    console.error("Resend webhook failed:", error);
    return NextResponse.json({ ok: false, error: "Resend webhook failed" }, { status: 500 });
  }
}
