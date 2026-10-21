import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

// First consorcio of the owner, as created by the onboarding checkout: the units the owner declared
// there and how many are already loaded.
export type UnitsSetup = {
  communityId: string;
  name: string;
  address: string;
  declared: number | null;
  loaded: number;
  existingNumbers: string[];
};

export async function getUnitsSetup(): Promise<UnitsSetup | null> {
  try {
    const supabase = await createClient();
    const context = await getAuthContext(supabase);
    if (context.status !== "resolved" || context.userType !== "tenant" || context.role !== "TENANT_OWNER") return null;
    const { data: community } = await supabase
      .from("edificios")
      .select("id, nombre, direccion, total_unidades")
      .eq("organization_id", context.organizationId)
      .order("created_at")
      .order("id")
      .limit(1)
      .maybeSingle();
    if (!community) return null;
    const { data: units, error } = await supabase.from("unidades").select("numero").eq("edificio_id", community.id);
    if (error) return null;
    const existingNumbers = (units ?? []).map((unit) => String(unit.numero ?? "")).filter(Boolean);
    return {
      communityId: community.id,
      name: community.nombre,
      address: community.direccion,
      declared: community.total_unidades,
      loaded: units?.length ?? 0,
      existingNumbers,
    };
  } catch {
    return null;
  }
}
