"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { drainResidentEmailOutbox, resendConfigFromEnv } from "@/server/resident-emails/resident-email-outbox";

import {
  approveResidentRequest,
  correctResidentRequestEmail,
  ResidentRequestReviewError,
  rejectResidentRequest,
} from "./resident-request-review";

type ActionResult = { success: true } | { success: false; error: string };

// The email is queued with the review; sending happens after the response and never fails the action.
function sendQueuedEmails() {
  after(async () => {
    try {
      await drainResidentEmailOutbox(supabaseAdmin, resendConfigFromEnv());
    } catch (error) {
      console.error("Resident email outbox drain failed:", error);
    }
  });
}

async function review(work: () => Promise<unknown>, fallbackError: string): Promise<ActionResult> {
  try {
    // The RPC checks role and consorcio; VIEWER is also stopped here so the error is clear.
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || context.role === "VIEWER") {
      return { success: false, error: "No tenés permiso para revisar solicitudes." };
    }
    await work();
  } catch (error) {
    return { success: false, error: error instanceof ResidentRequestReviewError ? error.message : fallbackError };
  }

  sendQueuedEmails();
  revalidatePath("/dashboard/solicitudes");
  return { success: true };
}

export async function approveResidentRequestAction(requestId: string): Promise<ActionResult> {
  if (!requestId) return { success: false, error: "La solicitud es obligatoria." };
  return review(
    async () => approveResidentRequest(await createClient(), requestId),
    "No se pudo aceptar la solicitud.",
  );
}

export async function rejectResidentRequestAction(requestId: string, reason: string): Promise<ActionResult> {
  if (!requestId) return { success: false, error: "La solicitud es obligatoria." };
  return review(
    async () => rejectResidentRequest(await createClient(), requestId, reason.trim() || null),
    "No se pudo rechazar la solicitud.",
  );
}

export async function correctResidentRequestEmailAction(requestId: string, email: string): Promise<ActionResult> {
  if (!requestId) return { success: false, error: "La solicitud es obligatoria." };
  return review(
    async () => correctResidentRequestEmail(await createClient(), requestId, email),
    "No se pudo corregir el email.",
  );
}
