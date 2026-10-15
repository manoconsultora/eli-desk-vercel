import { type NextRequest, NextResponse } from "next/server";

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
  try {
    tokenHash = (await request.formData()).get("token_hash");
  } catch {
    return redirectToLogin(request);
  }
  if (typeof tokenHash !== "string" || !/^[A-Za-z0-9_-]{16,512}$/.test(tokenHash)) {
    return redirectToLogin(request);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
  if (error) return redirectToLogin(request);

  try {
    const context = await getAuthContext(supabase);
    if (context.status !== "resolved" || context.userType !== "tenant" || context.role !== "TENANT_OWNER") {
      await supabase.auth.signOut();
      return redirectToLogin(request);
    }
  } catch {
    await supabase.auth.signOut();
    return redirectToLogin(request);
  }

  return NextResponse.redirect(new URL("/dashboard/default", request.url), {
    status: 303,
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
