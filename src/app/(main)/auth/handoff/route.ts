import { type NextRequest, NextResponse } from "next/server";

import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/auth/active-organization";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowedLandingOrigins() {
  return new Set(
    (process.env.ELI_LANDING_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => {
        try {
          return new URL(origin.trim()).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  );
}

function redirectToLogin(request: NextRequest) {
  return NextResponse.redirect(new URL("/login?error=handoff_expired", request.url), {
    status: 303,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || !allowedLandingOrigins().has(origin)) {
    return new NextResponse("Origen no autorizado.", {
      status: 403,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }

  let tokenHash: FormDataEntryValue | null;
  let attemptId: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    tokenHash = form.get("token_hash");
    attemptId = form.get("attempt_id");
  } catch {
    return redirectToLogin(request);
  }
  if (typeof tokenHash !== "string" || !/^[A-Za-z0-9_-]{16,512}$/.test(tokenHash)) {
    return redirectToLogin(request);
  }
  if (
    typeof attemptId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)
  ) {
    return redirectToLogin(request);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) return redirectToLogin(request);

  let organizationId: string;
  try {
    const { data: inspection, error: inspectionError } = await supabase.rpc("resolve_authenticated_payment_checkout", {
      p_action: "inspect_attempt",
      p_attempt_id: attemptId,
    });
    if (
      inspectionError ||
      inspection?.decision !== "inspect_attempt" ||
      inspection.attempt?.attempt_id !== attemptId ||
      inspection.attempt?.attempt_status !== "approved"
    ) {
      throw new Error("handoff_attempt_not_authorized");
    }
    organizationId = inspection.attempt.organization_id;
    const context = await getAuthContext(supabase, organizationId);
    if (
      context.status !== "resolved" ||
      context.userType !== "tenant" ||
      context.role !== "TENANT_OWNER" ||
      context.organizationId !== organizationId
    ) {
      await supabase.auth.signOut({ scope: "local" });
      return redirectToLogin(request);
    }
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    return redirectToLogin(request);
  }

  const response = NextResponse.redirect(new URL("/dashboard/default", request.url), {
    status: 303,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
  response.cookies.set(ACTIVE_ORGANIZATION_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
  });
  return response;
}
