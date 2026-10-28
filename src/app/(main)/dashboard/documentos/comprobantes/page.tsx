import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { getDeskFeatureAccess } from "@/server/access/resolve-desk-feature-access";
import { type CommunitySummary, listCommunities } from "@/server/communities/community-repository";
import { listComprobantes } from "@/server/comprobantes/comprobante-repository";

import { ComprobantesFolder, type ComprobantesFolderData } from "../_components/comprobantes-folder";

function MessageState({ title, body }: { title: string; body: string }) {
  return (
    <section className="flex min-h-80 items-center justify-center rounded-3xl border border-border/60 bg-muted/20 p-8 text-center">
      <div className="max-w-md space-y-2">
        <h1 className="font-semibold text-xl">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
      </div>
    </section>
  );
}

type Loaded = { communities: CommunitySummary[]; selected: CommunitySummary | null; folder: ComprobantesFolderData };

// The consorcios come filtered by the Documentos scope, so a ?consorcio= outside it (typed by hand)
// is never listed: it falls back to the first one. RLS alone would allow every consorcio of the membership.
async function loadDocuments(requested: string | undefined): Promise<Loaded | null> {
  try {
    const access = await getDeskFeatureAccess("documentos");
    if (access?.consorcioScope == null) return null;
    const supabase = await createClient();
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || !context.organizationId) return null;
    const communities = await listCommunities(supabase, context.organizationId, access.consorcioScope);
    const selected = communities.find((community) => community.id === requested) ?? communities[0] ?? null;
    const comprobantes = selected ? await listComprobantes(supabase, selected.id).catch(() => null) : [];
    return { communities, selected, folder: { comprobantes, canManage: context.role !== "VIEWER" } };
  } catch {
    return null;
  }
}

export default async function ComprobantesPage({ searchParams }: { searchParams: Promise<{ consorcio?: string }> }) {
  // Auth starts alongside access; the loader below reuses the cached result.
  const [access] = await Promise.all([getDeskFeatureAccess("documentos"), getRequestAuthContext()]);
  if (access?.state !== "resolved") {
    return <MessageState title="Sin acceso" body="No se puede mostrar el módulo con el acceso actual." />;
  }

  const { consorcio } = await searchParams;
  const loaded = await loadDocuments(consorcio);
  if (loaded === null) {
    return <MessageState title="No se pudieron cargar los documentos" body="Probá de nuevo en unos minutos." />;
  }
  if (loaded.selected === null) {
    return <MessageState title="Sin consorcios" body="No tenés consorcios asignados para ver documentos." />;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-medium text-muted-foreground text-sm">Documentos</p>
        <h1 className="font-semibold text-3xl tracking-tight">Comprobantes</h1>
        <p className="mt-1 text-muted-foreground">Los PDF de los gastos de cada liquidación, agrupados por mes.</p>
      </header>

      <ComprobantesFolder
        // A new consorcio starts with a clean upload list and search.
        key={loaded.selected.id}
        communities={loaded.communities.map(({ id, name }) => ({ id, name }))}
        communityId={loaded.selected.id}
        data={loaded.folder}
      />
    </div>
  );
}
