"use server";

import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

import { type CreatedJoinLink, createJoinLink, revokeJoinLink } from "./join-link-repository";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// The RPC checks the role on the consorcio; VIEWER is also stopped here so the error is clear.
export async function createJoinLinkAction(communityId: string): Promise<ActionResult<CreatedJoinLink>> {
  if (!communityId) return { success: false, error: "Elegí un consorcio." };

  try {
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || context.role === "VIEWER") {
      return { success: false, error: "No tenés permiso para crear links de acceso." };
    }

    const supabase = await createClient();
    return { success: true, data: await createJoinLink(supabase, communityId) };
  } catch {
    return { success: false, error: "No se pudo crear el link de acceso." };
  }
}

export async function revokeJoinLinkAction(linkId: string): Promise<ActionResult<null>> {
  if (!linkId) return { success: false, error: "El link es obligatorio." };

  try {
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || context.role === "VIEWER") {
      return { success: false, error: "No tenés permiso para anular links de acceso." };
    }

    const supabase = await createClient();
    await revokeJoinLink(supabase, linkId);
    return { success: true, data: null };
  } catch {
    return { success: false, error: "No se pudo anular el link." };
  }
}
