"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import {
  AlertCircle,
  Building2,
  Download,
  Eye,
  FileText,
  History,
  MoreHorizontal,
  Pencil,
  Play,
  Search,
  Send,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { OnboardingCase } from "@/lib/platform-onboarding/contracts";
import { createOnboardingCsv, filterCasesByPeriod, type OnboardingPeriod } from "@/lib/platform-onboarding/exporting";
import { caseStatusLabel, caseVisualState, onboardingProgressValue } from "@/lib/platform-onboarding/presentation";

type Filter = "all" | "active" | "inactive" | "abandoned";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function createdDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  const parts = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric" }).formatToParts(
    date,
  );
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")} ${part("month").replaceAll(".", "")} ${part("year")}`;
}

function isInCurrentMonth(value: string) {
  const date = new Date(value);
  const now = new Date();
  return (
    !Number.isNaN(date.getTime()) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  );
}

const filters: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "active", label: "Activas" },
  { id: "inactive", label: "Inactivas" },
  { id: "abandoned", label: "Abandonadas" },
];

const periods: Array<{ id: OnboardingPeriod; label: string }> = [
  { id: "all", label: "Todos los períodos" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mes" },
  { id: "year", label: "Este año" },
];

export function OnboardingList({ cases, loadError = false }: { cases: OnboardingCase[]; loadError?: boolean }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [period, setPeriod] = useState<OnboardingPeriod>("all");
  const periodCases = useMemo(() => filterCasesByPeriod(cases, period), [cases, period]);
  const buckets = useMemo(
    () => ({
      all: periodCases.length,
      active: periodCases.filter((item) => caseVisualState(item.status) === "active").length,
      inactive: periodCases.filter((item) => caseVisualState(item.status) === "inactive").length,
      abandoned: periodCases.filter((item) => caseVisualState(item.status) === "abandoned").length,
    }),
    [periodCases],
  );
  const monthlyCount = useMemo(() => cases.filter((item) => isInCurrentMonth(item.created_at)).length, [cases]);
  const results = useMemo(
    () =>
      periodCases.filter((item) => {
        const term = query.trim().toLocaleLowerCase("es");
        return (
          (!term ||
            [item.organization_name, item.contact_name, item.contact_email, item.id].some((value) =>
              value.toLocaleLowerCase("es").includes(term),
            )) &&
          (filter === "all" || caseVisualState(item.status) === filter)
        );
      }),
    [periodCases, query, filter],
  );

  function exportResults() {
    const csv = createOnboardingCsv(
      results.map((item) => ({
        organization_name: item.organization_name,
        contact_name: item.contact_name,
        contact_email: item.contact_email,
        contact_phone: item.contact_phone,
        status: caseStatusLabel(item.status),
        progress: onboardingProgressValue(item.onboarding_progress),
        onboarding_progress: item.onboarding_progress,
        payment_status: item.payment_status,
        desk_access_status: item.desk_access_status,
        fiscal_data_status: item.fiscal_data_status,
        requested_plan_code: item.requested_plan_code,
        organization_id: item.organization_id,
        subscription_id: item.subscription_id,
        created_at: item.created_at,
        updated_at: item.updated_at,
        safe_failure_code: item.safe_failure_code,
      })),
    );
    const blobUrl = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = blobUrl;
    anchor.download = `eli-onboarding-${filter}-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-7 pb-32 sm:pb-12">
      <header className="flex flex-col items-center gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2 text-center sm:text-left">
          <p className="font-semibold text-primary text-xs uppercase tracking-[0.18em]">
            ELI Platform Admin / Seguimiento
          </p>
          <h1 className="font-semibold text-3xl tracking-tight sm:text-4xl">Onboarding</h1>
          <p className="text-muted-foreground">Seguimiento de altas y configuración inicial</p>
        </div>
        <div className="relative w-full sm:w-[270px] sm:shrink-0">
          <label htmlFor="onboarding-search" className="sr-only">
            Buscar administración o contacto
          </label>
          <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            id="onboarding-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar administración o contacto"
            className="h-10 border-border/80 bg-background pl-9 text-sm shadow-none"
          />
        </div>
      </header>

      <section aria-label="Resumen y filtros de onboarding" className="space-y-4">
        <ul
          className="flex justify-center gap-5 text-muted-foreground text-xs sm:justify-end"
          aria-label="Leyenda de estados"
        >
          <span className="inline-flex items-center gap-2">
            <i className="size-3 rounded-full bg-[#2346DD]" />
            Activa
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="size-3 rounded-full bg-[#D8DCE5]" />
            Inactiva
          </span>
          <span className="inline-flex items-center gap-2">
            <i className="size-3 rounded-full border border-[#98A1B5] bg-white" />
            Abandonada
          </span>
        </ul>
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-center gap-5 text-center sm:gap-8">
            <div className="pr-5 sm:border-r sm:pr-8">
              <p className="text-muted-foreground text-sm">Altas del mes</p>
              <p className="font-medium text-3xl leading-none tracking-tight">{loadError ? "—" : monthlyCount}</p>
            </div>
            <div className="pr-5 sm:border-r sm:pr-8">
              <p className="text-muted-foreground text-sm">Activas</p>
              <p className="font-medium text-3xl text-[#2346DD] leading-none tracking-tight">
                {loadError ? "—" : buckets.active}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-sm">Pendientes</p>
              <p className="font-medium text-3xl leading-none tracking-tight">{loadError ? "—" : buckets.inactive}</p>
            </div>
          </div>
          <fieldset className="mx-auto flex w-fit min-w-0 max-w-full gap-1 overflow-x-auto pb-1 sm:gap-2">
            <legend className="sr-only">Filtrar por estado</legend>
            {filters.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-10 sm:gap-2 sm:px-4 sm:text-sm ${filter === id ? "border-[#2346DD] bg-[#2346DD] text-white shadow-sm" : "border-border bg-background text-foreground hover:bg-muted"}`}
              >
                {label}
                <span
                  className={`min-w-3.5 rounded-full px-1 py-0.5 text-[9px] sm:min-w-5 sm:px-1.5 sm:text-xs ${filter === id ? "bg-white/15 text-white" : "bg-muted text-muted-foreground"}`}
                >
                  {loadError ? "—" : buckets[id]}
                </span>
              </button>
            ))}
          </fieldset>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <label className="flex items-center gap-2 text-muted-foreground text-xs">
            <span>Período</span>
            <select
              aria-label="Filtrar por período"
              value={period}
              onChange={(event) => setPeriod(event.target.value as OnboardingPeriod)}
              className="h-8 rounded-md border bg-background px-2 text-foreground text-xs"
            >
              {periods.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs"
            onClick={exportResults}
            disabled={results.length === 0}
          >
            <Download className="size-3.5" />
            Exportar CSV
            {results.length > 0 ? <span className="text-[11px] text-muted-foreground">({results.length})</span> : null}
          </Button>
        </div>
      </section>

      <section aria-labelledby="onboardings-title" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="onboardings-title" className="sr-only">
            Onboardings
          </h2>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
            }}
            className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
            hidden={!query && filter === "all"}
          >
            Limpiar filtros
          </button>
        </div>
        {loadError ? (
          <div role="alert" className="flex gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
            <AlertCircle className="size-5 text-destructive" />
            <div>
              <p className="font-medium">No pudimos cargar los registros</p>
              <p className="text-muted-foreground">Revisá la conexión local y los permisos del módulo.</p>
              <Button className="mt-3" size="sm" variant="outline" onClick={() => window.location.reload()}>
                Volver a intentar
              </Button>
            </div>
          </div>
        ) : null}
        {!loadError && cases.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
            <Building2 className="mx-auto size-8 text-muted-foreground" />
            <h3 className="mt-3 font-medium">Todavía no hay onboardings</h3>
            <p className="mt-1 text-muted-foreground text-sm">No hay casos persistidos visibles para esta cuenta.</p>
          </div>
        ) : null}
        {!loadError && cases.length > 0 && results.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card p-10 text-center">
            <Search className="mx-auto size-8 text-muted-foreground" />
            <h3 className="mt-3 font-medium">No encontramos resultados</h3>
            <p className="mt-1 text-muted-foreground text-sm">Probá ajustar la búsqueda o el estado.</p>
          </div>
        ) : null}
        {!loadError && results.length > 0 ? (
          <ul className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((item) => {
              const state = caseVisualState(item.status);
              const progress = onboardingProgressValue(item.onboarding_progress);
              const cardClass =
                state === "active"
                  ? "border-[#2346DD] bg-[#2346DD] text-white hover:bg-[#1D3FCB]"
                  : state === "abandoned"
                    ? "border-[#DCE0E9] bg-white text-[#18213A] bg-[repeating-linear-gradient(135deg,transparent,transparent_7px,rgba(120,132,158,0.07)_7px,rgba(120,132,158,0.07)_8px)] hover:border-[#AEB6C7]"
                    : "border-transparent bg-[#EEF0F5] text-[#18213A] hover:bg-[#E8EBF1]";
              const progressDone =
                state === "active" ? "bg-white" : state === "abandoned" ? "bg-[#9AA3B6]" : "bg-[#2346DD]";
              const progressTodo = state === "active" ? "bg-white/35" : "bg-[#D3D7E0]";
              return (
                <li key={item.id} className="min-w-0">
                  <article
                    className={`group hover:-translate-y-0.5 relative flex min-h-[144px] flex-col overflow-hidden rounded-2xl border p-3 shadow-sm transition duration-200 hover:shadow-md sm:min-h-[154px] sm:p-5 ${cardClass}`}
                  >
                    <Link
                      href={`/platform/onboarding/${item.id}`}
                      aria-label={`Abrir detalle de ${item.organization_name}`}
                      className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2346DD] focus-visible:ring-inset"
                    />
                    <div className="pointer-events-none relative z-[1] flex min-w-0 items-start justify-between gap-2">
                      <h3 className="line-clamp-2 min-w-0 break-words font-semibold text-xs tracking-tight sm:line-clamp-none sm:truncate sm:text-base">
                        {item.organization_name}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Acciones para ${item.organization_name}`}
                            className={`-mr-2 -mt-2 pointer-events-auto relative z-10 shrink-0 rounded-full ${state === "active" ? "text-white hover:bg-white/15 hover:text-white" : "text-[#17264F] hover:bg-black/5"}`}
                          >
                            <MoreHorizontal className="size-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-2">
                          <DropdownMenuLabel className="px-2 py-1 font-medium text-muted-foreground text-xs">
                            {caseStatusLabel(item.status)}
                          </DropdownMenuLabel>
                          <DropdownMenuItem asChild className="gap-3 px-2 py-2.5 text-sm">
                            <Link href={`/platform/onboarding/${item.id}`}>
                              <Eye className="size-4 text-[#2346DD]" />
                              Ver detalle
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="gap-3 px-2 py-2.5 text-sm">
                            <Link href={`/platform/onboarding/${item.id}?view=fiscal`}>
                              <FileText className="size-4 text-[#2346DD]" />
                              Datos fiscales
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild className="gap-3 px-2 py-2.5 text-sm">
                            <Link href={`/platform/onboarding/${item.id}#onboarding-events`}>
                              <History className="size-4 text-[#2346DD]" />
                              Historial de eventos
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-2" />
                          <DropdownMenuItem disabled className="items-start gap-3 px-2 py-2.5 text-sm">
                            <Pencil className="mt-0.5 size-4" />
                            <span>
                              <span className="block">Editar datos</span>
                              <span className="mt-0.5 block font-normal text-muted-foreground text-xs">
                                Edición todavía no disponible
                              </span>
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled className="items-start gap-3 px-2 py-2.5 text-sm">
                            <Send className="mt-0.5 size-4" />
                            <span>
                              <span className="block">Reenviar invitación</span>
                              <span className="mt-0.5 block font-normal text-muted-foreground text-xs">
                                Envío de invitaciones no conectado
                              </span>
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled className="items-start gap-3 px-2 py-2.5 text-sm">
                            <Play className="mt-0.5 size-4" />
                            <span>
                              <span className="block">Activar manualmente</span>
                              <span className="mt-0.5 block font-normal text-muted-foreground text-xs">
                                Pendiente de revisión de seguridad
                              </span>
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-2" />
                          <DropdownMenuItem
                            disabled
                            className="items-start gap-3 px-2 py-2.5 text-destructive text-sm focus:text-destructive"
                          >
                            <Trash2 className="mt-0.5 size-4" />
                            <span>
                              <span className="block">Cancelar registro</span>
                              <span className="mt-0.5 block font-normal text-muted-foreground text-xs">
                                Cancelación no habilitada
                              </span>
                            </span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div
                      className="pointer-events-none relative z-[1] mt-3 flex items-center gap-1 sm:gap-1.5"
                      role="progressbar"
                      aria-label={`Progreso del caso: ${caseStatusLabel(item.status)}`}
                      aria-valuemin={0}
                      aria-valuemax={5}
                      aria-valuenow={progress}
                    >
                      {Array.from({ length: 5 }, (_, index) => (
                        <span
                          // biome-ignore lint/suspicious/noArrayIndexKey: barra fija de 5 segmentos que no se reordenan
                          key={index}
                          className={`h-[5px] flex-1 rounded-full ${index < progress ? progressDone : progressTodo}`}
                        />
                      ))}
                    </div>

                    <div className="pointer-events-none relative z-[1] mt-auto flex min-w-0 items-end gap-2 pt-4 sm:gap-3">
                      <div
                        className={`hidden size-11 shrink-0 place-items-center rounded-full font-medium text-sm sm:grid ${state === "active" ? "bg-white/30 text-white" : "bg-[#DCE5FF] text-[#2346DD]"}`}
                      >
                        {initials(item.contact_name)}
                      </div>
                      <div className="min-w-0 flex-1 pb-0.5">
                        <p className="truncate font-medium text-[11px] sm:text-sm">{item.contact_name}</p>
                        <p
                          className={`mt-0.5 text-[10px] sm:text-xs ${state === "active" ? "text-white/80" : "text-[#64708B]"}`}
                        >
                          {createdDate(item.created_at)}
                        </p>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={`/platform/onboarding/${item.id}?view=fiscal`}
                            aria-label={`Datos fiscales de ${item.organization_name}`}
                            className="pointer-events-auto relative z-10 grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#2346DD] shadow-sm transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-10"
                          >
                            <FileText className="size-4 sm:size-[18px]" />
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent>Datos fiscales</TooltipContent>
                      </Tooltip>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
