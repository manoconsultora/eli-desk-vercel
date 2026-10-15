import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import type { UnresolvedReason } from "@/lib/auth/types";
import { logoutAction } from "@/server/server-actions";

const UNRESOLVED_REASON_COPY: Record<UnresolvedReason, string> = {
  unknown_internal_user: "Tu cuenta fue autenticada, pero no tiene acceso interno configurado en este entorno.",
  platform_suspended: "Tu acceso de plataforma está suspendido temporalmente.",
  platform_inactive: "Tu acceso de plataforma está inactivo.",
  membership_suspended: "Tu acceso a esta organización está suspendido.",
  membership_inactive: "Tu acceso a esta organización está inactivo.",
  membership_invited: "Tu invitación todavía no fue activada.",
  organization_suspended: "La organización asociada está suspendida.",
  organization_cancelled: "La organización asociada fue cancelada.",
  organization_archived: "La organización asociada fue archivada.",
  invalid_configuration: "Encontramos una configuración interna inválida para tu acceso.",
};

export default async function AuthUnresolvedPage() {
  const context = await getRequestAuthContext();
  const message =
    context.authenticated && context.status === "unresolved"
      ? UNRESOLVED_REASON_COPY[context.reason]
      : UNRESOLVED_REASON_COPY.unknown_internal_user;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-16">
      <div className="max-w-xl space-y-4 text-center">
        <p className="text-muted-foreground text-sm uppercase tracking-[0.2em]">Cuenta autenticada</p>
        <h1 className="font-semibold text-3xl tracking-tight">Acceso interno no disponible</h1>
        <p className="text-muted-foreground">{message}</p>
        <form action={logoutAction} className="pt-2">
          <button
            type="submit"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-xs transition-colors hover:bg-primary/90"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </main>
  );
}
