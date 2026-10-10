import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

// pg_cron in Supabase calls the drain route with the secret stored in Vault.
export function isResidentEmailCronAuthorized(
  authorization: string | null,
  secret = process.env.RESIDENT_EMAIL_CRON_SECRET ?? "",
) {
  // Trimmed like the Resend variables: a pasted value can carry a trailing newline.
  const expected = secret.trim();
  if (!expected || !authorization) return false;
  return timingSafeEqual(digest(authorization), digest(`Bearer ${expected}`));
}
