"use client";

import { useCallback, useEffect, useState } from "react";

import { subscribeTicketRslEvent } from "@/lib/realtime/ticket-rsl-events";
import {
  getDashboardTicketSummary,
  getDashboardTicketTrend,
  listTickets as listTicketsAction,
} from "@/server/tickets/ticket-actions";

// ─── Types ───────────────────────────────────────────────────────────
export type DashboardMetrics = {
  edificios: number;
  ticketsPendientes: number;
  ticketsUrgentes: number;
  staleTickets48h: number;
  tiempoPromedioResolucion: string;
};

export type TicketRow = {
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
};

export type ChartDataPoint = {
  date: string;
  abiertos: number;
  enProceso: number;
  cerrados: number;
  total: number;
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
