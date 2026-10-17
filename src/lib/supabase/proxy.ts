import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as NextServerResponse } from "next/server";

import { createServerClient } from "@supabase/ssr";

type ProxyResponse = NextResponse<unknown>;

export function createProxyClient(request: NextRequest) {
  let response: ProxyResponse = NextServerResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          response = NextServerResponse.next({
            request: {
              headers: request.headers,
            },
          });

          Object.entries(headers).forEach(([key, value]) => {
            response.headers.set(key, value);
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  return {
    supabase,
    getResponse() {
      return response;
    },
  };
}

export function applySupabaseProxyResponse(targetResponse: ProxyResponse, sourceResponse: ProxyResponse) {
  sourceResponse.headers.forEach((value, key) => {
    if (key.toLowerCase().startsWith("x-middleware-")) {
      return;
    }

    targetResponse.headers.set(key, value);
  });

  sourceResponse.cookies.getAll().forEach((cookie) => {
    targetResponse.cookies.set(cookie);
  });

  return targetResponse;
}
