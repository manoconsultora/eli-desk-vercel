"use server";

import { revalidatePath } from "next/cache";

import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

import { addToBlacklist, BlacklistError, removeFromBlacklist } from "./resident-blacklist-repository";

type ActionResult = { success: true } | { success: false; error: string };

async function run(
  allowedRoles: string[],
  forbidden: string,
  work: () => Promise<void>,
  fallbackError: string,
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

  revalidatePath("/dashboard/solicitudes");
  return { success: true };
}

export async function addToBlacklistAction(requestId: string, reason: string): Promise<ActionResult> {
  if (!requestId) return { success: false, error: "La solicitud es obligatoria." };
  return run(
    ["TENANT_OWNER", "ADMIN", "OPERATOR"],
    "No tenés permiso para agregar contactos a la blacklist.",
    async () => addToBlacklist(await createClient(), requestId, reason.trim() || null),
    "No se pudo agregar el contacto a la blacklist.",
  );
}

// The blacklist applies to the whole organization, so only TENANT_OWNER and ADMIN remove.
export async function removeFromBlacklistAction(entryId: string): Promise<ActionResult> {
  if (!entryId) return { success: false, error: "La entrada es obligatoria." };
  return run(
    ["TENANT_OWNER", "ADMIN"],
    "No tenés permiso para quitar contactos de la blacklist.",
    async () => removeFromBlacklist(await createClient(), entryId),
    "No se pudo quitar el contacto de la blacklist.",
  );
}
