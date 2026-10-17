import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return NextResponse.json({
    ok: !error,
    authenticated: Boolean(user),
    userId: user?.id ?? null,
    error: error?.message ?? null,
  });
}
