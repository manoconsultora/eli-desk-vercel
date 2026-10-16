import { type NextRequest, NextResponse } from "next/server";

import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/auth/active-organization";
import { getAuthContextForIdentity } from "@/lib/auth/get-auth-context";
import {
  getAuthDestination,
  LOGIN_ROUTE,
  PLATFORM_HOME_ROUTE,
  SELECT_ORGANIZATION_ROUTE,
  TENANT_HOME_ROUTE,
  UNRESOLVED_ROUTE,
} from "@/lib/auth/get-auth-destination";
import { applySupabaseProxyResponse, createProxyClient } from "@/lib/supabase/proxy";

function withNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function isDashboardPath(pathname: string) {
  return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
}

function isPlatformPath(pathname: string) {
  return pathname === "/platform" || pathname.startsWith("/platform/");
}

function isUnresolvedPath(pathname: string) {
  return pathname === UNRESOLVED_ROUTE || pathname.startsWith(`${UNRESOLVED_ROUTE}/`);
}

function isOrganizationSelectionPath(pathname: string) {
  return pathname === SELECT_ORGANIZATION_ROUTE || pathname.startsWith(`${SELECT_ORGANIZATION_ROUTE}/`);
}

function isAllowedPathForDestination(pathname: string, destination: string) {
  if (destination === TENANT_HOME_ROUTE) {
    return isDashboardPath(pathname);
  }

  if (destination === PLATFORM_HOME_ROUTE) {
    return isPlatformPath(pathname);
  }

  if (destination === UNRESOLVED_ROUTE) {
    return isUnresolvedPath(pathname);
  }

  if (destination === SELECT_ORGANIZATION_ROUTE) {
    return isOrganizationSelectionPath(pathname);
  }

  return pathname === destination;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLoginPage = pathname === LOGIN_ROUTE;
  const isDashboard = isDashboardPath(pathname);
  const isPlatform = isPlatformPath(pathname);
  const isUnresolved = isUnresolvedPath(pathname);
  const isOrganizationSelection = isOrganizationSelectionPath(pathname);
  const isProtectedRoute = isDashboard || isPlatform || isUnresolved || isOrganizationSelection;

  const { supabase, getResponse } = createProxyClient(request);
  const { data, error } = await supabase.auth.getClaims();
  const supabaseResponse = getResponse();

  const userId = !error && typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const email = !error && typeof data?.claims?.email === "string" ? data.claims.email : null;

  if (!userId) {
    if (!isProtectedRoute) {
      return withNoStore(supabaseResponse);
    }

    const loginUrl = new URL(LOGIN_ROUTE, request.url);
    loginUrl.searchParams.set("from", pathname);

    return withNoStore(applySupabaseProxyResponse(NextResponse.redirect(loginUrl), supabaseResponse));
  }

  const context = await getAuthContextForIdentity(
    supabase,
    { userId, email },
    request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value,
  );
  const destination = getAuthDestination(context);

  if (isLoginPage || !isAllowedPathForDestination(pathname, destination)) {
    return withNoStore(
      applySupabaseProxyResponse(NextResponse.redirect(new URL(destination, request.url)), supabaseResponse),
    );
  }

  return withNoStore(supabaseResponse);
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/login",
    "/platform",
    "/platform/:path*",
    "/auth/unresolved",
    "/auth/select-organization",
  ],
};
