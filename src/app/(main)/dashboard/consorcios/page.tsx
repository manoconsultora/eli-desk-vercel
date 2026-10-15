import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { getDeskFeatureAccess } from "@/server/access/resolve-desk-feature-access";
import { type CommunitySummary, getCommunityDetail, listCommunities } from "@/server/communities/community-repository";
import { listJoinLinks } from "@/server/join-links/join-link-repository";

import { CommunitiesList } from "./_components/communities-list";
import { CommunityDrawer, type CommunityDrawerResult } from "./_components/community-drawer";

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

async function loadCommunities(): Promise<CommunitySummary[] | null> {
  try {
    const access = await getDeskFeatureAccess("consorcios");
    if (access?.consorcioScope == null) return null;
    const supabase = await createClient();
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || !context.organizationId) return null;
    return await listCommunities(supabase, context.organizationId, access.consorcioScope);
  } catch {
    return null;
  }
}

async function loadCommunity(communityId: string): Promise<CommunityDrawerResult> {
  try {
    const access = await getDeskFeatureAccess("consorcios");
    if (access?.consorcioScope == null) return { kind: "error" };
    const supabase = await createClient();
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || !context.organizationId) return { kind: "error" };
    const community = await getCommunityDetail(supabase, context.organizationId, access.consorcioScope, communityId);
    if (!community) return { kind: "not_found" };
    // A failure here only empties the Accesos tab; the rest of the drawer still shows.
    const links = await listJoinLinks(supabase, community.id).catch(() => null);
    const canManage = context.role !== "VIEWER";
    // Deleting follows the RLS policy: TENANT_OWNER and ADMIN only.
    const canDeleteUnits = ["TENANT_OWNER", "ADMIN"].includes(context.role ?? "");
    return { kind: "ok", community, joinLinks: { links, canManage }, canManageUnits: canManage, canDeleteUnits };
  } catch {
    return { kind: "error" };
  }
}

export default async function ConsorciosPage({ searchParams }: { searchParams: Promise<{ consorcio?: string }> }) {
  // Auth starts alongside access; the loaders below reuse the cached result.
  const [access] = await Promise.all([getDeskFeatureAccess("consorcios"), getRequestAuthContext()]);
  if (access?.state !== "resolved") {
    return <MessageState title="Sin acceso" body="No se puede mostrar el módulo con el acceso actual." />;
  }

  const { consorcio } = await searchParams;
  const [communities, detail] = await Promise.all([
    loadCommunities(),
    consorcio ? loadCommunity(consorcio) : Promise.resolve(null),
  ]);
  if (communities === null) {
    return <MessageState title="No se pudieron cargar los consorcios" body="Probá de nuevo en unos minutos." />;
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="font-medium text-muted-foreground text-sm">Administración</p>
        <h1 className="font-semibold text-3xl tracking-tight">Consorcios</h1>
        <p className="mt-1 text-muted-foreground">Consorcios que tenés a cargo, con sus unidades y tickets activos.</p>
      </header>

      <CommunitiesList communities={communities} />
      {consorcio && detail && <CommunityDrawer key={consorcio} result={detail} />}
    </div>
  );
}
