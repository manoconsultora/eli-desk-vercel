import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { getDeskFeatureAccess } from "@/server/access/resolve-desk-feature-access";
import { listResidentRequests, type ResidentRequest } from "@/server/resident-requests/resident-request-repository";

import { ResidentRequestsList } from "./_components/resident-requests-list";

function MessageState({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex min-h-[40vh] items-center justify-center rounded-3xl border border-border/60 bg-muted/20 p-8 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="font-semibold text-xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
    </section>
  );
}

// Solicitudes add residents, so they follow the residentes access and consorcio scope.
async function loadRequests(): Promise<ResidentRequest[] | null> {
  try {
    const access = await getDeskFeatureAccess("residentes");
    if (access?.consorcioScope == null) return null;
    const supabase = await createClient();
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || !context.organizationId) return null;
    return await listResidentRequests(supabase, context.organizationId, access.consorcioScope);
  } catch {
    return null;
  }
}

export default async function SolicitudesPage() {
  // Auth starts alongside access; the loaders below reuse the cached result.
  const [access] = await Promise.all([getDeskFeatureAccess("residentes"), getRequestAuthContext()]);
  if (access?.state !== "resolved") {
    return <MessageState title="Sin acceso" body="No se puede mostrar el módulo con el acceso actual." />;
  }

  const requests = await loadRequests();
  if (requests === null) {
    return <MessageState title="No se pudieron cargar las solicitudes" body="Probá de nuevo en unos minutos." />;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-medium text-muted-foreground text-sm">Administración</p>
        <h1 className="font-semibold text-3xl tracking-tight">Solicitudes</h1>
        <p className="mt-1 text-muted-foreground">Pedidos de alta de residentes.</p>
      </header>

      <ResidentRequestsList requests={requests} />
    </div>
  );
}
