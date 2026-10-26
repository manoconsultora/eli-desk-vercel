"use server";

import { revalidatePath } from "next/cache";

import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

import {
  addResidentRecordToBlacklist,
  addToBlacklist,
  BLACKLIST_REMOVER_ROLES,
  BlacklistError,
  removeFromBlacklist,
} from "./resident-blacklist-repository";

type ActionResult = { success: true } | { success: false; error: string };

type RunOptions = { allowedRoles: string[]; forbidden: string; fallbackError: string };

async function run(
  { allowedRoles, forbidden, fallbackError }: RunOptions,
  work: () => Promise<void>,
): Promise<ActionResult> {
  try {
    // The RPC checks the role too; this only gives a clear error.
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || !allowedRoles.includes(context.role)) {
      return { success: false, error: forbidden };
    }
    await work();
  } catch (error) {
    return { success: false, error: error instanceof BlacklistError ? error.message : fallbackError };
  }

  // Both pages show the blacklist.
  revalidatePath("/dashboard/solicitudes");
  revalidatePath("/dashboard/residentes");
  return { success: true };
}

export async function addToBlacklistAction(requestId: string, reason: string): Promise<ActionResult> {
  if (!requestId) return { success: false, error: "La solicitud es obligatoria." };
  return run(
    {
      allowedRoles: ["TENANT_OWNER", "ADMIN", "OPERATOR"],
      forbidden: "No tenés permiso para agregar contactos a la blacklist.",
      fallbackError: "No se pudo agregar el contacto a la blacklist.",
    },
    async () => addToBlacklist(await createClient(), requestId, reason.trim() || null),
  );
}

export async function addResidentRecordToBlacklistAction(residentId: string, reason: string): Promise<ActionResult> {
  if (!residentId) return { success: false, error: "El residente es obligatorio." };
  return run(
    {
      allowedRoles: ["TENANT_OWNER", "ADMIN", "OPERATOR"],
      forbidden: "No tenés permiso para agregar residentes a la blacklist.",
      fallbackError: "No se pudo agregar el residente a la blacklist.",
    },
    async () => addResidentRecordToBlacklist(await createClient(), residentId, reason.trim() || null),
  );
}

export async function removeFromBlacklistAction(entryId: string): Promise<ActionResult> {
  if (!entryId) return { success: false, error: "La entrada es obligatoria." };
  return run(
    {
      allowedRoles: BLACKLIST_REMOVER_ROLES,
      forbidden: "No tenés permiso para quitar contactos de la blacklist.",
      fallbackError: "No se pudo quitar el contacto de la blacklist.",
    },
    async () => removeFromBlacklist(await createClient(), entryId),
  );
}
