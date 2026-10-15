"use server";

import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { getResolvedDeskTicketScope, isEmptyDeskTicketScope } from "@/server/access/resolve-desk-ticket-scope";

import {
  closeTicket as closeTicketRepository,
  createTicket as createTicketRepository,
  getDashboardSummary,
  getTicketById as getTicketByIdRepository,
  getTicketTrend,
  listEdificios,
  listTickets as listTicketsRepository,
  type TicketRecord,
  updateTicket as updateTicketRepository,
  updateTicketStatus as updateTicketStatusRepository,
} from "./ticket-repository";
import { toUpdateInput, validateCloseReason, validateStatus, validateTicketInput } from "./ticket-service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function withTenant<T>(
  fallbackError: string,
  work: (supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string, userId: string) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const supabase = await createClient();
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || !context.organizationId || !context.userId) {
      return { success: false, error: "No se pudo resolver la organización autorizada." };
    }
    return {
      success: true,
      data: await work(supabase, context.organizationId, context.userId),
    };
  } catch {
    return { success: false, error: fallbackError };
  }
}

export async function listTickets(): Promise<ActionResult<TicketRecord[]>> {
  return withTenant("No se pudieron cargar los tickets.", async (supabase) => {
    const scope = await getResolvedDeskTicketScope();
    return scope === null || isEmptyDeskTicketScope(scope) ? [] : listTicketsRepository(supabase, scope);
  });
}

export async function getTicketById(id: string): Promise<ActionResult<TicketRecord | null>> {
  if (!id) return { success: false, error: "El ticket es obligatorio." };

  return withTenant("No se pudo cargar el ticket.", async (supabase, organizationId) => {
    const scope = await getResolvedDeskTicketScope();

    if (scope === null || isEmptyDeskTicketScope(scope)) {
      return null;
    }

    return getTicketByIdRepository(supabase, organizationId, scope, id);
  });
}

export async function listTicketEdificios(): Promise<ActionResult<{ id: string; nombre: string }[]>> {
  return withTenant("No se pudieron cargar los consorcios.", async (supabase) => {
    const scope = await getResolvedDeskTicketScope();
    return scope === null || isEmptyDeskTicketScope(scope) ? [] : listEdificios(supabase, scope);
  });
}

export async function getDashboardTicketSummary(): Promise<
  ActionResult<Awaited<ReturnType<typeof getDashboardSummary>>>
> {
  return withTenant("No se pudieron cargar los indicadores.", async (supabase) => {
    const scope = await getResolvedDeskTicketScope();
    return scope === null || isEmptyDeskTicketScope(scope)
      ? getDashboardSummary(supabase, { kind: "explicit", consorcioIds: [] })
      : getDashboardSummary(supabase, scope);
  });
}

export async function getDashboardTicketTrend(): Promise<ActionResult<Awaited<ReturnType<typeof getTicketTrend>>>> {
  return withTenant("No se pudo cargar la tendencia.", async (supabase) => {
    const scope = await getResolvedDeskTicketScope();
    return scope === null || isEmptyDeskTicketScope(scope) ? [] : getTicketTrend(supabase, scope);
  });
}

/** Escrituras: el scope efectivo de la feature Tickets, o error si no hay acceso operativo. */
async function requireWritableTicketScope() {
  const scope = await getResolvedDeskTicketScope();
  if (scope === null || isEmptyDeskTicketScope(scope)) {
    throw new Error("No hay consorcios habilitados para operar tickets.");
  }
  return scope;
}

export async function createTicket(input: Record<string, unknown>): Promise<ActionResult<TicketRecord>> {
  try {
    const validated = validateTicketInput(input);
    return withTenant("No se pudo crear el ticket.", async (supabase, organizationId, userId) =>
      createTicketRepository(supabase, organizationId, await requireWritableTicketScope(), userId, validated),
    );
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Los datos del ticket no son válidos." };
  }
}

export async function updateTicket(id: string, input: Record<string, unknown>): Promise<ActionResult<TicketRecord>> {
  if (!id) return { success: false, error: "El ticket es obligatorio." };
  try {
    const validated = toUpdateInput(input);
    return withTenant("No se pudo actualizar el ticket.", async (supabase, organizationId) =>
      updateTicketRepository(supabase, organizationId, await requireWritableTicketScope(), id, validated),
    );
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Los datos del ticket no son válidos." };
  }
}

export async function changeTicketStatus(id: string, value: unknown): Promise<ActionResult<TicketRecord>> {
  if (!id) return { success: false, error: "El ticket es obligatorio." };
  try {
    const status = validateStatus(value);
    return withTenant("No se pudo cambiar el estado.", async (supabase, organizationId) =>
      updateTicketStatusRepository(supabase, organizationId, await requireWritableTicketScope(), id, status),
    );
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "El estado no es válido." };
  }
}

export async function closeTicket(id: string, reason: unknown): Promise<ActionResult<TicketRecord>> {
  if (!id) return { success: false, error: "El ticket es obligatorio." };
  try {
    const closedReason = validateCloseReason(reason);
    return withTenant("No se pudo cerrar el ticket.", async (supabase, organizationId) =>
      closeTicketRepository(supabase, organizationId, await requireWritableTicketScope(), id, closedReason),
    );
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "El motivo de cierre no es válido." };
  }
}
