"use server";

import { revalidatePath } from "next/cache";

import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

import { EndResidentUnitLinkError, endResidentUnitLink } from "./resident-unit-link";
import { type ResidentDetails, UpdateResidentError, updateResident } from "./update-resident";

type ActionResult = { success: true } | { success: false; error: string };

export async function endResidentUnitLinkAction(linkId: string): Promise<ActionResult> {
  if (!linkId) return { success: false, error: "La unidad es obligatoria." };
  try {
    // The RPC checks role and consorcio; VIEWER is also stopped here so the error is clear.
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || context.role === "VIEWER") {
      return { success: false, error: "No tenés permiso para dar de baja residentes." };
    }
    await endResidentUnitLink(await createClient(), linkId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof EndResidentUnitLinkError ? error.message : "No se pudo dar de baja al residente.",
    };
  }

  revalidatePath("/dashboard/residentes");
  return { success: true };
}

export async function updateResidentAction(residentId: string, details: ResidentDetails): Promise<ActionResult> {
  if (!residentId) return { success: false, error: "El residente es obligatorio." };
  try {
    // The RPC checks role, consorcio and every field; VIEWER is also stopped here so the error is clear.
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || context.role === "VIEWER") {
      return { success: false, error: "No tenés permiso para editar residentes." };
    }
    await updateResident(await createClient(), residentId, details);
  } catch (error) {
    return {
      success: false,
      error: error instanceof UpdateResidentError ? error.message : "No se pudieron guardar los cambios.",
    };
  }

  revalidatePath("/dashboard/residentes");
  return { success: true };
}
