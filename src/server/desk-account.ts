"use server";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export type DeskPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_interval: "monthly" | "yearly" | null;
  max_consorcios: number | null;
  max_units: number | null;
};

export type DeskPlanMenuData = {
  canViewBilling: boolean;
  currentPlan: DeskPlan | null;
  subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null;
  plans: DeskPlan[];
};

const emptyData: DeskPlanMenuData = {
  canViewBilling: false,
  currentPlan: null,
  subscription: null,
  plans: [],
};

export async function getDeskPlanMenuData(): Promise<DeskPlanMenuData> {
  try {
    const supabase = await createClient();
    const context = await getAuthContext(supabase);
    if (context.status !== "resolved" || context.userType !== "tenant" || !context.organizationId) return emptyData;

    const { data: planRows } = await supabase
      .from("plans")
      .select("id, code, name, description, price, currency, billing_interval, max_consorcios, max_units")
      .eq("is_active", true)
      .order("price", { ascending: true });
    const plans = (planRows ?? []) as DeskPlan[];
    const canViewBilling = context.role === "TENANT_OWNER" || context.role === "ADMIN";
    if (!canViewBilling) return { ...emptyData, plans };

    const { data: subscriptionRow } = await supabase
      .from("subscriptions")
      .select("id, plan_id, status, current_period_end, cancel_at_period_end, created_at")
      .eq("organization_id", context.organizationId)
      .in("status", ["free", "trialing", "active", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      canViewBilling,
      currentPlan: plans.find((plan) => plan.id === subscriptionRow?.plan_id) ?? null,
      subscription: subscriptionRow
        ? {
            status: subscriptionRow.status,
            currentPeriodEnd: subscriptionRow.current_period_end,
            cancelAtPeriodEnd: subscriptionRow.cancel_at_period_end,
          }
        : null,
      plans,
    };
  } catch {
    return emptyData;
  }
}
