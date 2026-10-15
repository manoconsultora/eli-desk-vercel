"use client";

import * as React from "react";

import { ClipboardList, FileText, MessageSquareText, TriangleAlert } from "lucide-react";

import { useDashboardUser } from "@/app/(main)/dashboard/_components/dashboard-shell-client";
import { useDeskFeatureAccess } from "@/app/(main)/dashboard/_components/desk-access-context";
import { type TicketRow, useTickets } from "@/hooks/use-eli-data";
import { cn } from "@/lib/utils";

import { ChartAreaInteractive } from "./_components/chart-area-interactive";
import { MobileDashboardHome } from "./_components/mobile-dashboard-home";
import { SectionCards } from "./_components/section-cards";

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

function DesktopRecentActivity() {
  const { tickets, loading, error } = useTickets();
  const recentTickets = tickets.slice(0, 5);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-semibold text-2xl text-slate-900 tracking-tight">Actividad reciente</h2>
        <p className="mt-1 text-muted-foreground text-sm">Últimos tickets registrados.</p>
      </div>
      <div className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-background shadow-sm">
        {loading ? (
          <div className="space-y-3 p-4">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-14 animate-pulse rounded-2xl bg-muted/50" />
            ))}
          </div>
        ) : error ? (
          <p className="p-5 text-destructive text-sm">No se pudo cargar la actividad: {error}</p>
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
                    isClosed ? "bg-muted text-muted-foreground" : "bg-blue-50 text-blue-700",
                  )}
                >
                  <TicketIcon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-sm">{ticket.ticket_code || "Nuevo ticket"}</p>
                      <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">
                        {ticket.description || "Sin descripción"}
                      </p>
                    </div>
                    <span className="whitespace-nowrap text-muted-foreground text-xs">
                      {formatRelativeTime(ticket.created_at)}
                    </span>
                  </div>
                  <p className="mt-3 text-muted-foreground text-xs uppercase tracking-[0.18em]">
                    {ticket.edificio_nombre || "Sin consorcio asignado"}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export default function Page() {
  const { currentUser } = useDashboardUser();

  const [hydrated, setHydrated] = React.useState(false);
  const ticketsAccess = useDeskFeatureAccess("tickets");

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return <div className="h-24 animate-pulse rounded-[2rem] bg-muted/60" />;
  }

  if (ticketsAccess?.state !== "resolved") {
    return (
      <section className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-border/60 bg-muted/20 p-8 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="font-semibold text-xl">
            {ticketsAccess?.state === "coming_soon" ? "Próximamente" : "Sin acceso"}
          </h1>
          <p className="text-muted-foreground text-sm">
            No se puede mostrar el resumen operativo con el acceso actual.
          </p>
        </div>
      </section>
    );
  }

  if (window.innerWidth < 768) {
    return <MobileDashboardHome />;
  }

  return (
    <div className="@container/main flex flex-col gap-4 md:gap-6">
      <section className="dashboard-greeting px-1 py-4 lg:py-6">
        <h1 className="text-[clamp(4.5rem,7vw,8rem)] text-slate-900 leading-[0.88] tracking-[-0.06em]">
          <span className="font-light">Hola </span>
          <span className="font-bold">{currentUser.name}</span>
        </h1>
      </section>

      <SectionCards />
      <ChartAreaInteractive />
      <DesktopRecentActivity />
    </div>
  );
}
