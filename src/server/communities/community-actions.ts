"use server";

import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

import { createUnit } from "./community-repository";

type ActionResult = { success: true } | { success: false; error: string };

// RLS checks the role on the consorcio; VIEWER is also stopped here so the error is clear.
export async function createUnitAction(
  communityId: string,
  unit: { number: string; floor: string },
): Promise<ActionResult> {
  const number = unit.number.trim();
  if (!communityId) return { success: false, error: "Elegí un consorcio." };
  if (!number) return { success: false, error: "Ingresá el número de la unidad." };

  try {
    const context = await getRequestAuthContext();
    if (
      !context.authenticated ||
      context.userType !== "tenant" ||
      !context.organizationId ||
      context.role === "VIEWER"
    ) {
      return { success: false, error: "No tenés permiso para cargar unidades." };
    }

    const supabase = await createClient();
    const result = await createUnit(supabase, context.organizationId, communityId, {
      number,
      floor: unit.floor.trim() || null,
    });
    if (result.ok) return { success: true };
    return {
      success: false,
      error:
        result.reason === "duplicate"
          ? `Ya existe la unidad ${number} en este consorcio.`
          : "No tenés permiso para cargar unidades en este consorcio.",
    };
  } catch {
    return { success: false, error: "No se pudo cargar la unidad." };
  }
}
