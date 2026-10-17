"use client";

import { AlertTriangle, Building2, Clock3, Ticket } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardMetrics } from "@/hooks/use-eli-data";

function MetricCard({
  title,
  value,
  icon: Icon,
  loading,
  variant = "default",
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  variant?: "default" | "warning" | "danger";
}) {
  const variantStyles = {
    default: "border-border",
    warning: "border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10",
    danger: "border-destructive/50 bg-destructive/5 dark:bg-destructive/10",
  };

  const iconStyles = {
    default: "text-muted-foreground",
    warning: "text-amber-500",
    danger: "text-destructive",
  };

  return (
    <Card className={variantStyles[variant]}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">{title}</CardTitle>
        <Icon className={`size-5 ${iconStyles[variant]}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted" />
        ) : (
          <div className="font-bold text-3xl tabular-nums">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function SectionCards() {
  const { metrics, loading, error } = useDashboardMetrics();

  if (error) {
    return <p className="text-destructive text-sm">No se pudieron cargar los indicadores: {error}</p>;
  }

  return (
    <div className="grid @5xl/main:grid-cols-4 @xl/main:grid-cols-2 grid-cols-2 gap-3">
      <MetricCard title="Edificios activos" value={metrics.edificios} icon={Building2} loading={loading} />
      <MetricCard
        title="Tickets pendientes"
        value={metrics.ticketsPendientes}
        icon={Ticket}
        loading={loading}
        variant={metrics.ticketsPendientes > 10 ? "warning" : "default"}
      />
      <MetricCard
        title="Urgencias abiertas"
        value={metrics.ticketsUrgentes}
        icon={AlertTriangle}
        loading={loading}
        variant={metrics.ticketsUrgentes > 0 ? "danger" : "default"}
      />
      <MetricCard
        title="Sin movimiento +48h"
        value={metrics.staleTickets48h}
        icon={Clock3}
        loading={loading}
        variant={metrics.staleTickets48h > 0 ? "warning" : "default"}
      />
    </div>
  );
}
