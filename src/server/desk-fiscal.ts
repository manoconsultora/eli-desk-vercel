"use server";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import type { FiscalResult, FiscalSave, FiscalSnapshot } from "@/lib/eli-chat/types";
import { createClient } from "@/lib/supabase/server";

export type DeskFiscalInitial = { snapshot: FiscalSnapshot | null; sessionKey: string | null; error: string | null };

async function ownerContext() {
  const supabase = await createClient();
  const context = await getAuthContext(supabase);
  if (context.status !== "resolved" || context.userType !== "tenant" || context.role !== "TENANT_OWNER") return null;
  const { data } = await supabase.auth.getClaims();
  const sessionId = typeof data?.claims?.session_id === "string" ? data.claims.session_id : null;
  return {
    supabase,
    organizationId: context.organizationId,
    sessionKey: sessionId ? `${context.userId}:${context.organizationId}:${sessionId}` : null,
  };
}

export async function getDeskFiscalInitial(): Promise<DeskFiscalInitial> {
  try {
    const context = await ownerContext();
    if (!context) return { snapshot: null, sessionKey: null, error: null };
    const { data, error } = await context.supabase.rpc("get_desk_fiscal_setup", {
      p_organization_id: context.organizationId,
    });
    if (error?.code === "42501") return { snapshot: null, sessionKey: null, error: null };
    if (error)
      return {
        snapshot: null,
        sessionKey: context.sessionKey,
        error: "No pudimos consultar tus datos fiscales. Reintentá desde el menú de tu usuario.",
      };
    return { snapshot: data as FiscalSnapshot, sessionKey: context.sessionKey, error: null };
  } catch {
    return { snapshot: null, sessionKey: null, error: "No pudimos consultar tus datos fiscales." };
  }
}

export async function loadFiscalChat(): Promise<FiscalResult> {
  const initial = await getDeskFiscalInitial();
  return initial.snapshot
    ? { data: initial.snapshot }
    : { error: initial.error ?? "No tenés permiso para cargar los datos fiscales." };
}

export async function saveFiscalChat(input: FiscalSave): Promise<FiscalResult> {
  try {
    const context = await ownerContext();
    if (!context) return { error: "No tenés permiso para cargar los datos fiscales." };
    const patch = { ...input.answers };
    if (patch.legal_form === "Persona humana") patch.legal_form = "persona_humana";
    const { data, error } = await context.supabase.rpc("save_desk_fiscal_setup", {
      p_organization_id: context.organizationId,
      p_patch: patch,
      p_expected_revision: input.expectedRevision,
      p_request_id: input.requestId,
      p_step: input.step,
      p_review_mode: input.reviewMode,
      p_complete: input.complete,
    });
    if (error)
      return {
        error:
          error.code === "40001"
            ? "Hay cambios guardados desde otra pestaña. Elegí cómo continuar."
            : "No pudimos guardar. Revisá los datos y reintentá; conservamos tus respuestas.",
        conflict: error.code === "40001",
      };
    return { data: data as FiscalSnapshot };
  } catch {
    return { error: "No pudimos conectar. Conservamos tus respuestas; reintentá." };
  }
}

export async function postponeFiscalChat(): Promise<void> {
  const context = await ownerContext();
  if (!context) return;
  await context.supabase.rpc("postpone_desk_fiscal_setup", { p_organization_id: context.organizationId });
}
