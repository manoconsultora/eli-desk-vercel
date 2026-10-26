import { getRequestAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { getDeskFeatureAccess } from "@/server/access/resolve-desk-feature-access";
import {
  BLACKLIST_REMOVER_ROLES,
  type BlacklistEntry,
  listBlacklist,
} from "@/server/resident-blacklist/resident-blacklist-repository";
import {
  listRelationshipOptions,
  listUnitOptions,
  type RelationshipOption,
  type UnitOption,
} from "@/server/residents/add-resident-to-unit";
import { listResidents, type ResidentSummary } from "@/server/residents/resident-repository";

import { AddResidentDialog } from "./_components/add-resident-dialog";
import { ResidentsList } from "./_components/residents-list";

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

type Manage = { units: UnitOption[]; relationships: RelationshipOption[] };
type Loaded = {
  residents: ResidentSummary[];
  manage: Manage | null;
  blacklist: BlacklistEntry[] | null;
  canRemoveFromBlacklist: boolean;
};

// `manage` (units and relationships to add residents) only for roles that can change the padrón.
// `blacklist` is null if it didn't load: the list then hides the blacklist actions, not the residents.
async function loadResidents(): Promise<Loaded | null> {
  try {
    const access = await getDeskFeatureAccess("residentes");
    if (access?.consorcioScope == null) return null;
    const supabase = await createClient();
    const context = await getRequestAuthContext();
    if (!context.authenticated || context.userType !== "tenant" || !context.organizationId) return null;
    const canManage = context.role !== "VIEWER";
    const [residents, units, relationships, blacklist] = await Promise.all([
      listResidents(supabase, context.organizationId, access.consorcioScope),
      canManage ? listUnitOptions(supabase, context.organizationId, access.consorcioScope) : [],
      canManage ? listRelationshipOptions(supabase) : [],
      listBlacklist(supabase, context.organizationId).catch(() => null),
    ]);
    return {
      residents,
      manage: canManage ? { units, relationships } : null,
      blacklist,
      canRemoveFromBlacklist: BLACKLIST_REMOVER_ROLES.includes(context.role),
    };
  } catch {
    return null;
  }
}

export default async function ResidentesPage() {
  // Auth starts alongside access; the loaders below reuse the cached result.
  const [access] = await Promise.all([getDeskFeatureAccess("residentes"), getRequestAuthContext()]);
  if (access?.state !== "resolved") {
    return <MessageState title="Sin acceso" body="No se puede mostrar el módulo con el acceso actual." />;
  }

  const loaded = await loadResidents();
  if (loaded === null) {
    return <MessageState title="No se pudieron cargar los residentes" body="Probá de nuevo en unos minutos." />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-medium text-muted-foreground text-sm">Administración</p>
          <h1 className="font-semibold text-3xl tracking-tight">Residentes</h1>
          <p className="mt-1 text-muted-foreground">Residentes de tus consorcios, con sus unidades.</p>
        </div>
        {loaded.manage && <AddResidentDialog units={loaded.manage.units} relationships={loaded.manage.relationships} />}
      </header>

      <ResidentsList
        residents={loaded.residents}
        manage={loaded.manage}
        blacklist={loaded.blacklist}
        canRemoveFromBlacklist={loaded.canRemoveFromBlacklist}
      />
    </div>
  );
}
