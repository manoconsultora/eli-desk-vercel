"use server";

import { isConsorcioInScope } from "@/lib/access/consorcio-scope";
import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import {
  CARPETA_ITEM,
  type Carpeta,
  COMPROBANTE_BUCKET,
  comprobanteFileProblem,
  isCarpeta,
  isMonthlyCarpeta,
  periodFromMonthInput,
} from "@/lib/comprobantes/comprobante-rules";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getDeskFeatureAccess } from "@/server/access/resolve-desk-feature-access";

import {
  confirmComprobante,
  createComprobante,
  deleteComprobante,
  findCommunityOrganization,
  findComprobanteRef,
} from "./comprobante-repository";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export type ComprobanteUpload = { id: string; path: string; token: string };

// Said before the row is read, so it can't name the folder.
const NOT_FOUND = "El archivo no existe o no lo tenés asignado.";

// Signed links to open a file last this long, so a copied link stops working soon.
const VIEW_URL_SECONDS = 120;

function noUploadPermission(carpeta: Carpeta): string {
  return `No tenés permiso para cargar ${CARPETA_ITEM[carpeta].plural}.`;
}

async function canWrite(): Promise<boolean> {
  const context = await getRequestAuthContext();
  return context.authenticated && context.userType === "tenant" && context.role !== "VIEWER";
}

// RLS lets through any organization of the user and only looks at the membership's consorcios.
// Here: the active organization only, with Documentos resolved and the consorcio in its scope.
async function documentosAllows(target: { organizationId: string | null; communityId: string }): Promise<boolean> {
  const [context, access] = await Promise.all([getRequestAuthContext(), getDeskFeatureAccess("documentos")]);
  return (
    context.authenticated &&
    target.organizationId !== null &&
    target.organizationId === context.organizationId &&
    access?.state === "resolved" &&
    access.consorcioScope !== null &&
    isConsorcioInScope(access.consorcioScope, target.communityId)
  );
}

// The RPC checks the role on the consorcio and chooses the path. The service role only signs the
// upload to that exact path, so the browser uploads straight to Storage without passing through Desk.
export async function startComprobanteUploadAction(input: {
  communityId: string;
  carpeta: Carpeta;
  // "2026-10" in the folders by month; ignored in the others.
  month: string;
  fileName: string;
  size: number;
}): Promise<ActionResult<ComprobanteUpload>> {
  // The action is callable from outside Desk's UI, so the folder is checked here too.
  if (!isCarpeta(input.carpeta)) return { success: false, error: "Esa carpeta no existe." };
  const period = isMonthlyCarpeta(input.carpeta) ? periodFromMonthInput(input.month) : null;
  if (!input.communityId || (isMonthlyCarpeta(input.carpeta) && !period)) {
    return { success: false, error: "Elegí el mes." };
  }
  const problem = comprobanteFileProblem({ name: input.fileName, size: input.size });
  if (problem) return { success: false, error: problem };

  try {
    if (!(await canWrite())) return { success: false, error: noUploadPermission(input.carpeta) };

    const supabase = await createClient();
    const organizationId = await findCommunityOrganization(supabase, input.communityId);
    if (!(await documentosAllows({ organizationId, communityId: input.communityId }))) {
      return { success: false, error: noUploadPermission(input.carpeta) };
    }
    const created = await createComprobante(supabase, {
      communityId: input.communityId,
      carpeta: input.carpeta,
      period,
      name: input.fileName,
    });
    const { data, error } = await supabaseAdmin.storage
      .from(COMPROBANTE_BUCKET)
      .createSignedUploadUrl(created.storagePath);
    if (error) throw new Error(error.message);

    return { success: true, data: { id: created.id, path: created.storagePath, token: data.token } };
  } catch {
    return { success: false, error: "No se pudo cargar el archivo. Probá de nuevo." };
  }
}

export async function confirmComprobanteUploadAction(comprobanteId: string): Promise<ActionResult<null>> {
  if (!comprobanteId) return { success: false, error: NOT_FOUND };

  try {
    if (!(await canWrite())) return { success: false, error: "No tenés permiso para cargar archivos." };

    const supabase = await createClient();
    const ref = await findComprobanteRef(supabase, comprobanteId);
    if (!ref || !(await documentosAllows(ref))) return { success: false, error: NOT_FOUND };
    await confirmComprobante(supabase, comprobanteId);
    return { success: true, data: null };
  } catch {
    return { success: false, error: "El archivo no se terminó de cargar. Probá de nuevo." };
  }
}

// RLS and the Documentos scope decide whether the user sees the file; only then the service role signs a short link.
export async function openComprobanteAction(comprobanteId: string): Promise<ActionResult<string>> {
  if (!comprobanteId) return { success: false, error: NOT_FOUND };

  try {
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant") {
      return { success: false, error: "No tenés permiso para ver este archivo." };
    }

    const supabase = await createClient();
    const ref = await findComprobanteRef(supabase, comprobanteId);
    if (!ref?.uploaded || !(await documentosAllows(ref))) {
      return { success: false, error: NOT_FOUND };
    }

    const { data, error } = await supabaseAdmin.storage
      .from(COMPROBANTE_BUCKET)
      .createSignedUrl(ref.storagePath, VIEW_URL_SECONDS);
    if (error) throw new Error(error.message);
    return { success: true, data: data.signedUrl };
  } catch {
    return { success: false, error: "No se pudo abrir el archivo. Probá de nuevo." };
  }
}

// Checked before the RPC, which deletes the row right away; then the file goes through the Storage API.
// `fileKept`: the row is gone but the file stayed in the bucket, so the list still has to refresh.
export async function deleteComprobanteAction(comprobanteId: string): Promise<ActionResult<{ fileKept: boolean }>> {
  if (!comprobanteId) return { success: false, error: NOT_FOUND };

  try {
    if (!(await canWrite())) return { success: false, error: "No tenés permiso para borrar archivos." };

    const supabase = await createClient();
    const ref = await findComprobanteRef(supabase, comprobanteId);
    if (!ref || !(await documentosAllows(ref))) return { success: false, error: NOT_FOUND };
    const path = await deleteComprobante(supabase, comprobanteId);
    // The row is already gone. Storage returns the error instead of throwing, so it is checked here:
    // a file that stays in the bucket must not be reported as deleted.
    const { error } = await supabaseAdmin.storage.from(COMPROBANTE_BUCKET).remove([path]);
    return { success: true, data: { fileKept: Boolean(error) } };
  } catch {
    return { success: false, error: "No se pudo borrar el archivo. Probá de nuevo." };
  }
}
