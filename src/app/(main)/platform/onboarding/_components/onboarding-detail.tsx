"use client";

import { useState } from "react";

import Link from "next/link";

import { AlertCircle, ArrowLeft, Building2, Check, Copy, FileText, ShieldCheck, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { OnboardingCase, OnboardingEvent } from "@/lib/platform-onboarding/contracts";
import { onboardingEventLabel } from "@/lib/platform-onboarding/event-presentation";
import { caseStatusLabel } from "@/lib/platform-onboarding/presentation";
import type { OrganizationFiscalData } from "@/server/platform-onboarding/fiscal";

type FiscalResult = { status: "available" | "pending" | "error"; data: OrganizationFiscalData | null };

export function OnboardingDetail({
  item,
  events = [],
  fiscal = { status: "pending", data: null },
  loadError = false,
  initialFiscalOpen = false,
}: {
  item?: OnboardingCase;
  events?: OnboardingEvent[];
  fiscal?: FiscalResult;
  loadError?: boolean;
  initialFiscalOpen?: boolean;
}) {
  const [fiscalOpen, setFiscalOpen] = useState(initialFiscalOpen);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  if (loadError || !item)
    return (
      <main className="mx-auto max-w-[1440px] space-y-5">
        <Link href="/platform/onboarding" className="text-primary text-sm">
          ← Volver a Onboarding
        </Link>
        <div role="alert" className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
          <h1 className="font-semibold">No pudimos cargar este caso</h1>
          <p className="text-muted-foreground text-sm">Revisá la conexión local y los permisos del módulo.</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Volver a intentar
          </Button>
        </div>
      </main>
    );
  const progress = { unknown: 0, initial_data_saved: 1, setup_in_progress: 2, checkout_started: 3, completed: 5 }[
    item.onboarding_progress
  ];
  const onboardingProgress = {
    unknown: "Sin dato de avance",
    initial_data_saved: "Datos iniciales guardados",
    setup_in_progress: "Configuración en curso",
    checkout_started: "Checkout iniciado",
    completed: "Onboarding completado",
  }[item.onboarding_progress];
  const paymentStatus = {
    unknown: "Sin dato de pago",
    not_started: "No iniciado",
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    failed: "Fallido",
  }[item.payment_status];
  const deskAccessStatus = {
    unknown: "Sin dato de acceso",
    not_enabled: "No habilitado",
    enabled: "Habilitado",
    suspended: "Suspendido",
  }[item.desk_access_status];
  const fiscalDataStatus =
    fiscal.status === "error"
      ? "Consulta con error"
      : fiscal.status === "pending"
        ? "Pendiente"
        : fiscal.data?.has_fiscal_data
          ? "Disponible"
          : "No informado";
  const fields: [string, string | null | undefined][] = [
    ["Nombre / razón social", fiscal.data?.legal_name],
    ["Tipo de titular", fiscal.data?.legal_form],
    [fiscal.data?.tax_id_type ?? "CUIT / DNI", fiscal.data?.tax_id],
    ["Condición frente al IVA", fiscal.data?.vat_condition],
    ["Domicilio fiscal", fiscal.data?.fiscal_address],
    ["Ciudad", fiscal.data?.city],
    ["Provincia", fiscal.data?.province],
    ["Email", fiscal.data?.email],
    ["Ingresos Brutos", fiscal.data?.iibb_category],
    ["Jurisdicción IIBB", fiscal.data?.iibb_jurisdiction],
  ];
  async function copyFiscalField(label: string, value: string | null | undefined) {
    try {
      await navigator.clipboard.writeText(value || "Pendiente");
      setCopiedField(label);
      setCopyError(false);
      window.setTimeout(() => setCopiedField((current) => (current === label ? null : current)), 1600);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <main className="mx-auto w-full max-w-[1440px] space-y-6 pb-12">
      <Link href="/platform/onboarding" className="inline-flex items-center gap-2 text-primary text-sm">
        <ArrowLeft className="size-4" /> Volver a Onboarding
      </Link>
      <header className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary/10 font-semibold text-primary">
              <Building2 className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-primary text-xs uppercase tracking-[0.16em]">
                Onboarding · caso persistido
              </p>
              <h1 className="mt-1 break-words font-semibold text-2xl sm:text-3xl">{item.organization_name}</h1>
              <p className="mt-1 text-muted-foreground text-sm">
                {item.contact_name} · {item.contact_email}
              </p>
              <p className="mt-1 break-all text-muted-foreground text-xs">ID {item.id}</p>
            </div>
          </div>
          <Badge variant={item.status === "active" ? "default" : "secondary"}>{caseStatusLabel(item.status)}</Badge>
        </div>
      </header>
      <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <h2 className="font-semibold">Avance del onboarding</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          {onboardingProgress}. Este avance es independiente del estado del caso en Platform.
        </p>
        <div
          className="mt-4 flex gap-2"
          role="progressbar"
          aria-label="Avance del onboarding"
          aria-valuemin={0}
          aria-valuemax={5}
          aria-valuenow={progress}
        >
          {Array.from({ length: 5 }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: barra fija de 5 segmentos que no se reordenan
            <span key={index} className={`h-2 flex-1 rounded-full ${index < progress ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <dt className="text-muted-foreground text-xs">Pago</dt>
            <dd className="mt-1 font-medium text-sm">{paymentStatus}</dd>
          </div>
          <div className="rounded-xl border p-3">
            <dt className="text-muted-foreground text-xs">Acceso a Desk</dt>
            <dd className="mt-1 font-medium text-sm">{deskAccessStatus}</dd>
          </div>
          <div className="rounded-xl border p-3">
            <dt className="text-muted-foreground text-xs">Datos fiscales</dt>
            <dd className="mt-1 font-medium text-sm">{fiscalDataStatus}</dd>
          </div>
        </dl>
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold">Administración</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="flex gap-3 rounded-xl bg-muted/40 p-4">
                <UserRound className="size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-muted-foreground text-xs">Contacto</p>
                  <p className="font-medium text-sm">{item.contact_name}</p>
                  <p className="break-all text-muted-foreground text-xs">{item.contact_email}</p>
                </div>
              </div>
              <div className="flex gap-3 rounded-xl bg-muted/40 p-4">
                <Building2 className="size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-muted-foreground text-xs">Organización</p>
                  <p className="font-medium text-sm">{item.organization_name}</p>
                  <p className="break-all text-muted-foreground text-xs">
                    {item.organization_id ?? "Aún no vinculada"}
                  </p>
                </div>
              </div>
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold">Plan y suscripción</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">Plan solicitado</p>
                <p className="font-medium">{item.requested_plan_code ?? "Pendiente"}</p>
              </div>
              <div className="rounded-xl border p-4">
                <p className="text-muted-foreground text-xs">Suscripción vinculada</p>
                <p className="break-all font-medium text-sm">{item.subscription_id ?? "Pendiente"}</p>
              </div>
            </div>
          </section>
          <section id="onboarding-events" className="scroll-mt-6 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="font-semibold">Actividad reciente</h2>
            {events.length ? (
              <ol className="mt-4 space-y-3">
                {events.map((event, index) => (
                  <li key={event.id} className="rounded-xl border p-3">
                    <p className="font-medium text-sm">{onboardingEventLabel(event, events[index - 1])}</p>
                    <p className="text-muted-foreground text-xs">
                      {new Date(event.created_at).toLocaleString("es-AR")}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 text-muted-foreground text-sm">No hay eventos disponibles para este caso.</p>
            )}
          </section>
        </div>
        <aside className="space-y-5">
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-primary" />
              <h2 className="font-semibold">Datos fiscales</h2>
            </div>
            <p className="mt-2 text-muted-foreground text-sm">Consulta de solo lectura de la organización vinculada.</p>
            <Button className="mt-4 w-full" variant="outline" onClick={() => setFiscalOpen(true)}>
              Datos fiscales
            </Button>
          </section>
          <section className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              <h2 className="font-semibold">Acciones MANO</h2>
            </div>
            <p className="mt-2 text-muted-foreground text-sm">
              Las acciones de la maqueta permanecen deshabilitadas hasta conectar comandos persistidos y auditables.
            </p>
          </section>
          {item.safe_failure_code ? (
            <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              <AlertCircle className="mr-2 inline size-4" />
              Incidencia: {item.safe_failure_code}
            </section>
          ) : null}
        </aside>
      </div>
      <Dialog open={fiscalOpen} onOpenChange={setFiscalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Datos fiscales</DialogTitle>
            <DialogDescription>{item.organization_name} · consulta de solo lectura</DialogDescription>
          </DialogHeader>
          {fiscal.status === "error" ? (
            <div className="space-y-3">
              <p role="alert" className="rounded-lg border border-destructive/30 p-4 text-sm">
                No pudimos consultar los datos fiscales de esta organización.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Reintentar consulta
              </Button>
            </div>
          ) : (
            <>
              {fiscal.status === "pending" ? (
                <p className="rounded-lg bg-muted p-4 text-sm">Datos fiscales pendientes</p>
              ) : null}
              {copyError ? (
                <p role="alert" className="text-destructive text-sm">
                  No se pudo copiar el dato. Revisá el permiso del portapapeles y volvé a intentar.
                </p>
              ) : null}
              {fiscal.data ? (
                <>
                  <p className="sr-only" aria-live="polite">
                    {copiedField ? `${copiedField} copiado` : ""}
                  </p>
                  <dl className="grid max-h-[55vh] gap-3 overflow-y-auto sm:grid-cols-2">
                    {fields.map(([label, value]) => (
                      <div key={label} className="rounded-lg border p-3">
                        <dt className="text-muted-foreground text-xs">{label}</dt>
                        <dd className="mt-1 flex min-w-0 items-start justify-between gap-2 font-medium text-sm">
                          <span className="min-w-0 break-words">{value || "Pendiente"}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            aria-label={`Copiar ${label}`}
                            title={copiedField === label ? "Copiado" : `Copiar ${label}`}
                            onClick={() => void copyFiscalField(label, value)}
                            className="shrink-0"
                          >
                            <span className="sr-only">Copiar</span>
                            {copiedField === label ? (
                              <Check className="size-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="size-3.5" />
                            )}
                          </Button>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </>
              ) : null}
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
