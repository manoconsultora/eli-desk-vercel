import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type NotificationBody = { ticketId?: string; closedReason?: string };

export async function POST(request: Request) {
  const webhookUrl = process.env.N8N_TICKET_CLOSED_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_TICKET_CLOSED_WEBHOOK_SECRET;

  if (!webhookUrl || !webhookSecret) {
    console.error("Ticket notification webhook is not configured.");
    return NextResponse.json({ ok: false, error: "Notification unavailable." }, { status: 503 });
  }

  let body: NotificationBody;
  try {
    body = (await request.json()) as NotificationBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const ticketId = body.ticketId?.trim() ?? "";
  const closedReason = body.closedReason?.trim() ?? "";
  if (!ticketId || !closedReason || closedReason.length > 1000) {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const supabase = await createClient();
  const authContext = await getAuthContext(supabase);
  if (!authContext.authenticated || authContext.status !== "resolved") {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  let ticketQuery = supabase
    .from("tickets")
    .select("id, ticket_code, chat_id, description, status")
    .eq("id", ticketId)
    .eq("status", "cerrado")
    .is("deleted_at", null);
  if (authContext.userType === "tenant") {
    ticketQuery = ticketQuery.eq("organization_id", authContext.organizationId);
  }
  const { data: ticket, error } = await ticketQuery.single();
  if (error || !ticket) return NextResponse.json({ ok: false, error: "Ticket not found." }, { status: 404 });

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-eli-secret": webhookSecret },
      body: JSON.stringify({
        chat_id: ticket.chat_id ?? "",
        ticket_code: ticket.ticket_code,
        closed_reason: closedReason,
        closed_by: authContext.email ?? authContext.userId,
        description: ticket.description ?? "",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      console.error("Ticket notification webhook failed:", response.status);
      return NextResponse.json({ ok: false, error: "Notification failed." }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Ticket notification webhook failed:", error);
    return NextResponse.json({ ok: false, error: "Notification failed." }, { status: 502 });
  }
}
