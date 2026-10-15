"use client";

import { type ReactNode, useState } from "react";

import { CircleHelp, CreditCard, FileText, LogOut, Settings, UserRound, WalletCards } from "lucide-react";

import { useDeskNavigationState } from "@/app/(main)/dashboard/_components/desk-access-context";
import { FiscalAlertDot, useFiscalSetup } from "@/app/(main)/dashboard/_components/fiscal-chat/fiscal-provider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { DeskPlan, DeskPlanMenuData } from "@/server/desk-account";

type AccountUser = { name: string; email: string; avatar: string };
type AccountDialog = "profile" | "plan" | "upgrade" | "invoices" | null;

function money(plan: DeskPlan) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: plan.currency,
    maximumFractionDigits: 0,
  }).format(plan.price);
}

function PlanFacts({ plan }: { plan: DeskPlan }) {
  const limits = [
    plan.max_consorcios === null ? null : `Hasta ${plan.max_consorcios} consorcios`,
    plan.max_units === null ? null : `Hasta ${plan.max_units} unidades`,
  ].filter(Boolean);
  const interval = plan.billing_interval === "monthly" ? "/ mes" : plan.billing_interval === "yearly" ? "/ año" : "";

  return (
    <div className="space-y-1">
      <p className="font-medium">
        {plan.name} · {money(plan)}
        {interval}
      </p>
      {plan.description && <p className="text-muted-foreground text-sm">{plan.description}</p>}
      {limits.length > 0 && <p className="text-muted-foreground text-sm">{limits.join(" · ")}</p>}
    </div>
  );
}

function subscriptionStatus(status: string) {
  const names: Record<string, string> = {
    free: "Gratis",
    trialing: "Prueba",
    active: "Activa",
    past_due: "Pago pendiente",
  };
  return names[status] ?? status;
}

export function TenantAccountMenu({
  user,
  logoutAction,
  planMenu,
  trigger,
  side = "bottom",
  align = "end",
}: {
  user: AccountUser;
  logoutAction: () => Promise<void>;
  planMenu: DeskPlanMenuData;
  trigger: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const [dialog, setDialog] = useState<AccountDialog>(null);
  const fiscal = useFiscalSetup();
  const settingsState = useDeskNavigationState("tenant_settings");
  const helpState = useDeskNavigationState("tenant_support");
  const currentPlan = planMenu.currentPlan;
  const higherPlans = currentPlan
    ? planMenu.plans.filter((plan) => plan.id !== currentPlan.id && plan.price > currentPlan.price)
    : [];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-64 rounded-xl" side={side} align={align} sideOffset={4}>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate font-semibold">{user.name}</span>
            <span className="block truncate text-muted-foreground text-xs">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setDialog("profile")}>
            <UserRound />
            Mi perfil
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!planMenu.canViewBilling} onSelect={() => setDialog("plan")}>
            <CreditCard />
            Mi plan
            {!planMenu.canViewBilling && <span className="ml-auto text-muted-foreground text-xs">Sin permiso</span>}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!planMenu.canViewBilling} onSelect={() => setDialog("upgrade")}>
            <WalletCards />
            Mejorar plan
            {!planMenu.canViewBilling && <span className="ml-auto text-muted-foreground text-xs">Sin permiso</span>}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setDialog("invoices")}>
            <FileText />
            Mis facturas
            {!planMenu.canViewBilling && <span className="ml-auto text-muted-foreground text-xs">Sin permiso</span>}
          </DropdownMenuItem>
          {fiscal.pending && (
            <DropdownMenuItem onSelect={fiscal.open}>
              <FileText />
              Completar datos
              <FiscalAlertDot className="ml-auto" />
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled>
            <Settings />
            Configuración
            <span className="ml-auto text-muted-foreground text-xs">
              {settingsState === "denied" ? "Sin permiso" : "No disponible"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <CircleHelp />
            Ayuda
            <span className="ml-auto text-muted-foreground text-xs">
              {helpState === "denied" ? "Sin permiso" : "No disponible"}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => void logoutAction()}>
            <LogOut />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          {dialog === "profile" && (
            <>
              <DialogHeader>
                <DialogTitle>Mi perfil</DialogTitle>
                <DialogDescription>Datos de la cuenta con la que ingresaste a ELI Desk.</DialogDescription>
              </DialogHeader>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Nombre</dt>
                  <dd>{user.name || "Sin nombre configurado"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Correo</dt>
                  <dd>{user.email || "Sin correo disponible"}</dd>
                </div>
              </dl>
            </>
          )}
          {dialog === "plan" && (
            <>
              <DialogHeader>
                <DialogTitle>Mi plan</DialogTitle>
                <DialogDescription>Suscripción actual del servicio de ELI.</DialogDescription>
              </DialogHeader>
              {planMenu.currentPlan ? (
                <div className="space-y-3">
                  <PlanFacts plan={planMenu.currentPlan} />
                  {planMenu.subscription && (
                    <p className="text-muted-foreground text-sm">
                      Estado: {subscriptionStatus(planMenu.subscription.status)}
                      {planMenu.subscription.currentPeriodEnd
                        ? ` · Próxima fecha de fin: ${new Date(planMenu.subscription.currentPeriodEnd).toLocaleDateString("es-AR")}`
                        : ""}
                      {planMenu.subscription.cancelAtPeriodEnd ? " · Cancelación al cierre del período" : ""}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No pudimos identificar una suscripción actual para esta organización.
                </p>
              )}
            </>
          )}
          {dialog === "upgrade" && (
            <>
              <DialogHeader>
                <DialogTitle>Mejorar plan</DialogTitle>
                <DialogDescription>
                  Comparativa del catálogo vigente de ELI. Los cambios de plan no se realizan desde esta pantalla.
                </DialogDescription>
              </DialogHeader>
              {planMenu.plans.length === 0 ? (
                <p className="text-muted-foreground text-sm">No hay planes disponibles para mostrar.</p>
              ) : (
                <div className="space-y-4">
                  {planMenu.plans.map((plan) => {
                    const current = plan.id === planMenu.currentPlan?.id;
                    const superior = higherPlans.some((option) => option.id === plan.id);
                    return (
                      <div key={plan.id} className="rounded-lg border p-4">
                        <p className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
                          {current ? "Tu plan actual" : superior ? "Opción superior" : "Plan ELI"}
                        </p>
                        <PlanFacts plan={plan} />
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
          {dialog === "invoices" && (
            <>
              <DialogHeader>
                <DialogTitle>Mis facturas</DialogTitle>
                <DialogDescription>Facturas del servicio contratado para esta organización.</DialogDescription>
              </DialogHeader>
              <div className="rounded-lg border border-dashed p-6 text-center">
                <p className="font-medium">Todavía no hay facturas disponibles</p>
                <p className="mt-1 text-muted-foreground text-sm">Cuando haya facturas del servicio, aparecerán acá.</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
