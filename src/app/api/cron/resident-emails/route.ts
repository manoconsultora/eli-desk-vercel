import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import { isResidentEmailCronAuthorized } from "@/server/resident-emails/resident-email-cron-auth";
import { drainResidentEmailOutbox, resendConfigFromEnv } from "@/server/resident-emails/resident-email-outbox";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Called every five minutes by pg_cron, so failed emails are retried without waiting for another review.
export async function POST(request: Request) {
  if (!isResidentEmailCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await drainResidentEmailOutbox(supabaseAdmin, resendConfigFromEnv());
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Resident email outbox drain failed:", error);
    return NextResponse.json({ ok: false, error: "Resident email outbox drain failed" }, { status: 500 });
  }
}
