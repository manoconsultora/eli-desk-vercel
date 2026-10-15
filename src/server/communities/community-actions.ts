"use server";

import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

import { createUnit, deleteUnit, importUnits, updateUnit } from "./community-repository";

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

const MAX_IMPORT_UNITS = 500;

// The dialog already shows a preview; this checks again because the action can be called directly.
export async function importUnitsAction(
  communityId: string,
  units: { number: string; floor: string | null }[],
): Promise<{ success: true; created: number } | { success: false; error: string }> {
  if (!communityId) return { success: false, error: "Elegí un consorcio." };
  const cleaned = units.map((unit) => ({ number: unit.number.trim(), floor: unit.floor?.trim() || null }));
  if (cleaned.length === 0) return { success: false, error: "No hay unidades para cargar." };
  if (cleaned.length > MAX_IMPORT_UNITS) {
    return { success: false, error: `Se pueden cargar hasta ${MAX_IMPORT_UNITS} unidades por vez.` };
  }
  if (cleaned.some((unit) => !unit.number)) return { success: false, error: "Hay unidades sin número." };

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
    const result = await importUnits(supabase, context.organizationId, communityId, cleaned);
    if (result.ok) return { success: true, created: result.created };
    return { success: false, error: "No tenés permiso para cargar unidades en este consorcio." };
  } catch {
    return { success: false, error: "No se pudieron cargar las unidades." };
  }
}

export async function updateUnitAction(unitId: string, unit: { number: string; floor: string }): Promise<ActionResult> {
  const number = unit.number.trim();
  if (!unitId) return { success: false, error: "Elegí una unidad." };
  if (!number) return { success: false, error: "Ingresá el número de la unidad." };

  try {
    const context = await getRequestAuthContext();
    if (
      !context.authenticated ||
      context.userType !== "tenant" ||
      !context.organizationId ||
      context.role === "VIEWER"
    ) {
      return { success: false, error: "No tenés permiso para editar unidades." };
    }

    const supabase = await createClient();
    const result = await updateUnit(supabase, context.organizationId, unitId, {
      number,
      floor: unit.floor.trim() || null,
    });
    if (result.ok) return { success: true };
    return {
      success: false,
      error:
        result.reason === "duplicate"
          ? `Ya existe la unidad ${number} en este consorcio.`
          : "No tenés permiso para editar esta unidad.",
    };
  } catch {
    return { success: false, error: "No se pudo guardar la unidad." };
  }
}

const DELETE_BLOCKED: Record<string, string> = {
  residents: "tiene residentes, actuales o anteriores",
  tickets: "tiene tickets",
  requests: "tiene solicitudes de alta",
  in_use: "tiene datos asociados",
};

// Only TENANT_OWNER and ADMIN can delete, as in the RLS policy; the unit must have nothing attached.
export async function deleteUnitAction(unitId: string, unitNumber: string): Promise<ActionResult> {
  if (!unitId) return { success: false, error: "Elegí una unidad." };

  try {
    const context = await getRequestAuthContext();
    if (
      !context.authenticated ||
      context.userType !== "tenant" ||
      !context.organizationId ||
      !["TENANT_OWNER", "ADMIN"].includes(context.role ?? "")
    ) {
      return { success: false, error: "No tenés permiso para borrar unidades." };
    }

    const supabase = await createClient();
    const result = await deleteUnit(supabase, context.organizationId, unitId);
    if (result.ok) return { success: true };
    if (result.reason === "forbidden") return { success: false, error: "No tenés permiso para borrar esta unidad." };
    return {
      success: false,
      error: `No se puede borrar la unidad ${unitNumber}: ${DELETE_BLOCKED[result.reason]}. Solo se borran unidades cargadas por error.`,
    };
  } catch {
    return { success: false, error: "No se pudo borrar la unidad." };
  }
}
