"use client";

import * as React from "react";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useChartData } from "@/hooks/use-eli-data";
import { useIsMobile } from "@/hooks/use-mobile";

const chartConfig = {
  date: { label: "Fecha" },
  abiertos: {
    label: "Tickets abiertos",
    color: "hsl(215, 70%, 60%)",
  },
  cerrados: {
    label: "Tickets cerrados",
    color: "hsl(0, 0%, 65%)",
  },
  enProceso: {
    label: "Tickets en proceso",
    color: "hsl(38, 92%, 50%)",
  },
} satisfies ChartConfig;

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");
  const { chartData, loading, error } = useChartData();

  React.useEffect(() => {
    if (isMobile) setTimeRange("7d");
  }, [isMobile]);

  const filteredData = React.useMemo(() => {
    const last = chartData.at(-1);
    if (!last) return [];
    const referenceDate = new Date(last.date);
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    const start = new Date(referenceDate);
    start.setDate(start.getDate() - days);
    return chartData.filter((item) => new Date(item.date) >= start);
  }, [chartData, timeRange]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Tickets: creados por día</CardTitle>
        <CardDescription>Evolución de tickets abiertos, en proceso y cerrados en el período.</CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="@[767px]/card:flex hidden *:data-[slot=toggle-group-item]:px-4!"
          >
            <ToggleGroupItem value="90d">90 días</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 días</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 días</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex @[767px]/card:hidden w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate"
              size="sm"
              aria-label="Período"
            >
              <SelectValue placeholder="90 días" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                90 días
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                30 días
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                7 días
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        {loading ? (
          <div className="flex h-62 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
          </div>
        ) : error ? (
          <div className="flex h-62 items-center justify-center text-destructive">
            No se pudo cargar la tendencia: {error}
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex h-62 items-center justify-center text-muted-foreground">
            No hay datos de tickets en este período
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-62 w-full">
            <AreaChart data={filteredData}>
              <defs>
                <linearGradient id="fillAbiertos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-abiertos)" stopOpacity={1.0} />
                  <stop offset="95%" stopColor="var(--color-abiertos)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillCerrados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-cerrados)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-cerrados)" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="fillEnProceso" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-enProceso)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-enProceso)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("es-AR", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <ChartTooltip
                cursor={false}
                defaultIndex={isMobile ? -1 : 10}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) =>
                      new Date(value).toLocaleDateString("es-AR", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                    }
                    indicator="dot"
                  />
                }
              />
              <Area dataKey="enProceso" type="natural" fill="url(#fillEnProceso)" stroke="var(--color-enProceso)" />
              <Area dataKey="cerrados" type="natural" fill="url(#fillCerrados)" stroke="var(--color-cerrados)" />
              <Area dataKey="abiertos" type="natural" fill="url(#fillAbiertos)" stroke="var(--color-abiertos)" />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
