"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribeTicketRslEvent } from "@/lib/realtime/ticket-rsl-events";
import {
  changeTicketStatus,
  closeTicket,
  createTicket as createTicketAction,
  getDashboardTicketSummary,
  getDashboardTicketTrend,
  listTicketEdificios,
  listTickets as listTicketsAction,
  updateTicket as updateTicketAction,
} from "@/server/tickets/ticket-actions";

// ─── Types ───────────────────────────────────────────────────────────
export interface DashboardMetrics {
  edificios: number;
  ticketsPendientes: number;
  ticketsUrgentes: number;
  staleTickets48h: number;
  tiempoPromedioResolucion: string;
}

export interface TicketRow {
  id: string;
  ticket_code: string;
  ticket_type: string;
  priority: string;
  category: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  edificio_nombre: string | null;
  edificio_id: string | null;
  chat_id: string | null;
  data: Record<string, unknown> | null;
}

export interface ChartDataPoint {
  date: string;
  abiertos: number;
  enProceso: number;
  cerrados: number;
  total: number;
}

export interface Edificio {
  id: string;
  nombre: string;
  direccion: string | null;
  codigo: string | null;
}

// ─── Tag suggestions by ticket type ──────────────────────────────────
export const tagSuggestions: Record<string, string[]> = {
  reclamo: [
    "plomería",
    "electricidad",
    "ascensor",
    "limpieza",
    "ruidos",
    "humedad",
    "filtraciones",
    "pintura",
    "portería",
  ],
  urgencia: ["incendio", "inundación", "gas", "rotura caño", "ascensor trabado", "corte luz", "seguridad"],
  consulta: ["expensas", "reglamento", "mudanza", "mascotas", "estacionamiento", "horarios", "documentación"],
  pago: ["expensas", "extraordinarias", "mora", "recibo", "factura"],
};

// ─── Hook: Metrics for Section Cards ─────────────────────────────────
export function useDashboardMetrics() {
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    edificios: 0,
    ticketsPendientes: 0,
    ticketsUrgentes: 0,
    staleTickets48h: 0,
    tiempoPromedioResolucion: "—",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getDashboardTicketSummary();
      if (!result.success) throw new Error(result.error);

      setMetrics({
        ...result.data,
        tiempoPromedioResolucion: "—",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => subscribeTicketRslEvent(() => void fetchMetrics()), [fetchMetrics]);

  return { metrics, loading, error, refetch: fetchMetrics };
}

// ─── Hook: Edificios list (for filter) ───────────────────────────────
export function useEdificios() {
  const [edificios, setEdificios] = useState<Edificio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEdificios() {
      const result = await listTicketEdificios();
      setEdificios(
        result.success ? result.data.map((edificio) => ({ ...edificio, direccion: null, codigo: null })) : [],
      );
      setLoading(false);
    }
    void fetchEdificios();
  }, []);

  return { edificios, loading };
}

// ─── Hook: Tickets List for DataTable ────────────────────────────────
export function useTickets() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await listTicketsAction();
      if (!result.success) throw new Error(result.error);

      const mapped: TicketRow[] = result.data.map((ticket) => ({
        id: ticket.id,
        ticket_code: ticket.ticket_code,
        ticket_type: ticket.ticket_type,
        priority: ticket.priority,
        category: ticket.category,
        description: ticket.description,
        status: ticket.status,
        created_at: ticket.created_at,
        updated_at: ticket.updated_at,
        edificio_id: ticket.edificio_id,
        chat_id: ticket.chat_id,
        edificio_nombre: ticket.edificio_nombre,
        data: ticket.data,
      }));

      setTickets(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching tickets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => subscribeTicketRslEvent(() => void fetchTickets()), [fetchTickets]);

  return { tickets, loading, error, refetch: fetchTickets };
}

// ─── Mutation: Update Ticket ─────────────────────────────────────────
export async function updateTicket(
  id: string,
  fields: Partial<{
    status: string;
    priority: string;
    ticket_type: string;
    category: string | null;
    description: string;
    edificio_id: string;
    data: Record<string, unknown>;
    closed_reason: string;
    closed_by: string;
    closed_at: string;
  }>,
): Promise<{ success: boolean; error?: string }> {
  if (fields.status === "cerrado") {
    const result = await closeTicket(id, fields.closed_reason ?? "");
    return result.success ? { success: true } : { success: false, error: result.error };
  }
  if (fields.status) {
    const result = await changeTicketStatus(id, fields.status);
    return result.success ? { success: true } : { success: false, error: result.error };
  }
  const result = await updateTicketAction(id, fields);
  return result.success ? { success: true } : { success: false, error: result.error };
}

// ─── Mutation: Soft Delete Ticket ────────────────────────────────────
export async function softDeleteTicket(
  id: string,
  reason: string,
  deletedBy = "dashboard-admin",
): Promise<{ success: boolean; error?: string }> {
  void id;
  void reason;
  void deletedBy;
  return { success: false, error: "La eliminación no forma parte del MVP de Tickets." };
}

// ─── Mutation: Updated Create Ticket ─────────────────────────────────────────
export async function createTicket(input: {
  edificio_id: string;
  ticket_type: string;
  priority: string;
  description: string;
  tags?: string[];
  created_by?: string;
}): Promise<{ success: boolean; error?: string }> {
  const result = await createTicketAction({
    edificio_id: input.edificio_id,
    ticket_type: input.ticket_type,
    priority: input.priority,
    category: input.tags?.[0] ?? null,
    description: input.description,
  });
  return result.success ? { success: true } : { success: false, error: result.error };
}

// ─── Hook: Chart Data (tickets per day) ──────────────────────────────
export function useChartData() {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchChartData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const trendResult = await getDashboardTicketTrend();
      if (!trendResult.success) throw new Error(trendResult.error);
      const tickets = trendResult.data;

      const dateMap = new Map<string, { abiertos: number; enProceso: number; cerrados: number; total: number }>();

      tickets?.forEach((ticket) => {
        const createdDate = ticket.created_at?.split("T")[0];
        if (!createdDate) return;

        if (!dateMap.has(createdDate)) {
          dateMap.set(createdDate, { abiertos: 0, enProceso: 0, cerrados: 0, total: 0 });
        }
        const entry = dateMap.get(createdDate);
        if (!entry) return;
        entry.total += 1;

        if (ticket.status === "abierto") entry.abiertos += 1;
        if (ticket.status === "en_proceso") entry.enProceso += 1;
        if (ticket.status === "cerrado") entry.cerrados += 1;
      });

      const result: ChartDataPoint[] = Array.from(dateMap.entries())
        .map(([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => a.date.localeCompare(b.date));

      setChartData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching chart data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  return { chartData, loading, error, refetch: fetchChartData };
}
