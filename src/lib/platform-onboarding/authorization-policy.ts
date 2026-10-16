import type { AuthContext } from "@/lib/auth/types";

export type PlatformOwnerRow = { role: string; status: string };

export function canAccessPlatformOnboarding(context: AuthContext, rows: PlatformOwnerRow[]): boolean {
  return (
    context.authenticated &&
    context.status === "resolved" &&
    context.userType === "platform" &&
    context.role === "PLATFORM_OWNER" &&
    rows.length === 1 &&
    rows[0].role === "PLATFORM_OWNER" &&
    rows[0].status === "active"
  );
}
