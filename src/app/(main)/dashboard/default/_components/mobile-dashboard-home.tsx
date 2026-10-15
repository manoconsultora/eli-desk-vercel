"use client";

import type * as React from "react";

import { Building2, ClipboardList, Clock3, FileText, MessageSquareText, TriangleAlert } from "lucide-react";

import { useDashboardUser } from "@/app/(main)/dashboard/_components/dashboard-shell-client";
import { FiscalAlertDot } from "@/app/(main)/dashboard/_components/fiscal-chat/fiscal-provider";
import { TenantAccountMenu } from "@/app/(main)/dashboard/_components/sidebar/tenant-account-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { type TicketRow, useDashboardMetrics, useTickets } from "@/hooks/use-eli-data";
import { cn, getInitials } from "@/lib/utils";

import { ChartAreaInteractive } from "./chart-area-interactive";

function formatRelativeTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return `Hace ${Math.round(hours / 24)} d`;
}

function getTicketIcon(ticket: TicketRow) {
  return ticket.ticket_type === "urgencia"
    ? TriangleAlert
    : ticket.ticket_type === "pago"
      ? FileText
      : ticket.ticket_type === "consulta"
        ? MessageSquareText
        : ClipboardList;
}

function MobileGreetingMenu() {
  const { currentUser, logoutAction, planMenu } = useDashboardUser();
  return (
    <TenantAccountMenu
      user={currentUser}
      logoutAction={logoutAction}
      planMenu={planMenu}
      align="start"
      trigger={
        <button
          type="button"
          className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-left font-semibold text-slate-700 text-sm shadow-sm"
          aria-label="Abrir menú de usuario"
        >
          <span className="relative inline-flex">
            <Avatar className="size-9 rounded-lg">
              <AvatarImage src={currentUser.avatar || undefined} alt={currentUser.name} />
              <AvatarFallback className="rounded-lg">{getInitials(currentUser.name)}</AvatarFallback>
              <FiscalAlertDot className="absolute -right-1 -top-1 size-3 ring-2 ring-background" />
            </Avatar>
          </span>
          <span className="block truncate">Hola, {currentUser.name} 👋</span>
        </button>
      }
    />
  );
}

function SummaryCard({
  title,
  value,
  detail,
  icon: Icon,
  loading,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <div className="rounded-[1.75rem] border border-blue-100/80 bg-gradient-to-br from-blue-50 via-white to-sky-50 p-4 shadow-[0_16px_45px_-30px_rgba(15,23,42,0.35)]">
      <div className="mb-5 inline-flex rounded-2xl bg-white/80 p-3 text-blue-700 shadow-sm">
        <Icon className="size-5" />
      </div>
      {loading ? (
        <div className="h-8 w-20 animate-pulse rounded-full bg-muted/70" />
      ) : (
        <>
          <p className="font-medium text-foreground/80 text-sm">{title}</p>
          <p className="mt-3 font-semibold text-3xl text-foreground tracking-tight">{value}</p>
          <p className="mt-2 text-muted-foreground text-sm">{detail}</p>
        </>
      )}
    </div>
  );
}

export function MobileDashboardHome() {
  const { metrics, loading: metricsLoading, error: metricsError } = useDashboardMetrics();
  const { tickets, loading: ticketsLoading, error: ticketsError } = useTickets();
  const recentTickets = tickets.slice(0, 3);

  return (
    <div className="space-y-6 md:hidden">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 p-4 shadow-[0_25px_80px_-32px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
        <MobileGreetingMenu />
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold text-2xl text-slate-900 tracking-tight">Resumen</h2>
          <p className="mt-1 text-muted-foreground text-sm">Tus indicadores principales del día.</p>
        </div>
        {metricsError ? (
          <p className="text-destructive text-sm">No se pudieron cargar los indicadores: {metricsError}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <SummaryCard
              title="Edificios activos"
              value={metrics.edificios}
              detail="bajo monitoreo"
              icon={Building2}
              loading={metricsLoading}
            />
            <SummaryCard
              title="Tickets abiertos"
              value={metrics.ticketsPendientes}
              detail="requieren seguimiento"
              icon={ClipboardList}
              loading={metricsLoading}
            />
            <SummaryCard
              title="Urgencias activas"
              value={metrics.ticketsUrgentes}
              detail={metrics.ticketsUrgentes > 0 ? "atención inmediata" : "sin incidentes críticos"}
              icon={TriangleAlert}
              loading={metricsLoading}
            />
            <SummaryCard
              title="Sin movimiento +48h"
              value={metrics.staleTickets48h}
              detail={metrics.staleTickets48h > 0 ? "requieren seguimiento" : "sin tickets estancados"}
              icon={Clock3}
              loading={metricsLoading}
            />
          </div>
        )}
      </section>
      <ChartAreaInteractive />
      <section id="actividad-reciente" className="space-y-3 pb-4">
        <div>
          <h2 className="font-semibold text-2xl text-slate-900 tracking-tight">Actividad reciente</h2>
          <p className="mt-1 text-muted-foreground text-sm">Últimos tickets registrados.</p>
        </div>
        <div className="overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/82 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)]">
          {ticketsLoading ? (
            <div className="space-y-4 p-4">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-2xl bg-muted/50" />
              ))}
            </div>
          ) : ticketsError ? (
            <p className="p-5 text-destructive text-sm">No se pudo cargar la actividad: {ticketsError}</p>
          ) : recentTickets.length === 0 ? (
            <p className="p-5 text-muted-foreground text-sm">Todavía no hay actividad para mostrar.</p>
          ) : (
            recentTickets.map((ticket, index) => {
              const TicketIcon = getTicketIcon(ticket);
              const isClosed = ticket.status === "cerrado";
              return (
                <div
                  key={ticket.id}
                  className={cn(
                    "flex items-start gap-3 p-4",
                    index !== recentTickets.length - 1 && "border-border/50 border-b",
                  )}
                >
                  <div
                    className={cn(
                      "rounded-2xl p-3",
                      isClosed ? "bg-slate-100 text-slate-400" : "bg-blue-50 text-blue-700",
                    )}
                  >
                    <TicketIcon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900 text-sm">
                          {ticket.ticket_code || "Nuevo ticket"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-slate-700 text-sm">
                          {ticket.description || "Sin descripción"}
                        </p>
                      </div>
                      <span className="whitespace-nowrap font-medium text-muted-foreground text-xs">
                        {formatRelativeTime(ticket.created_at)}
                      </span>
                    </div>
                    <p className="mt-3 text-slate-500 text-xs uppercase tracking-[0.18em]">
                      {ticket.edificio_nombre || "Sin consorcio asignado"}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
