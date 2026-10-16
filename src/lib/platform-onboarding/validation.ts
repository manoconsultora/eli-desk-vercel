export type CommercialMode = "paid" | "trial" | "internal_free";

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value);
  return normalized.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

export function validateCommercialSelection(input: {
  mode: string;
  planId: string;
  reason: string;
  freeExpiresAt?: string;
}): { ok: true; mode: CommercialMode } | { ok: false; code: string } {
  if (!input.planId.trim()) return { ok: false, code: "plan_required" };
  if (!input.reason.trim()) return { ok: false, code: "reason_required" };
  if (input.mode !== "paid" && input.mode !== "trial" && input.mode !== "internal_free") {
    return { ok: false, code: "unsupported_commercial_mode" };
  }
  if (input.mode === "internal_free" && input.freeExpiresAt) {
    const expiry = Date.parse(input.freeExpiresAt);
    if (!Number.isFinite(expiry) || expiry <= Date.now()) return { ok: false, code: "invalid_free_expiry" };
  }
  return { ok: true, mode: input.mode };
}

export function parseUnitRows(value: string): Array<{ numero: string; usage_type: string }> {
  const numbers = value
    .split(/[\n,;]/)
    .map((number) => number.trim())
    .filter(Boolean);
  const unique = [...new Set(numbers)];
  if (unique.length === 0 || unique.length !== numbers.length || unique.some((number) => number.length > 40)) {
    throw new Error("invalid_units");
  }
  return unique.map((numero) => ({ numero, usage_type: "vivienda" }));
}

export function isActivationSubscriptionEligible(input: {
  status: string;
  mode: string | null;
  freeGrantAudited: boolean;
  freeGrantExpired: boolean;
}): boolean {
  if (input.status === "active" || input.status === "trialing") return true;
  return input.status === "free" && input.mode === "internal_free" && input.freeGrantAudited && !input.freeGrantExpired;
}
