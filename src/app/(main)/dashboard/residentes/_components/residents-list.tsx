"use client";

import * as React from "react";

import Link from "next/link";

import { toast } from "sonner";

import { BlacklistDialog, RemoveFromBlacklistDialog } from "@/app/(main)/dashboard/_components/blacklist-dialogs";
import {
  FilterSelect,
  InitialsAvatar,
  ListCell,
  ListCount,
  ListEmpty,
  ListHead,
  ListSearch,
  ListTable,
  Pill,
} from "@/app/(main)/dashboard/_components/list-table";
import { relationshipLabel, relationshipTone } from "@/app/(main)/dashboard/consorcios/_components/community-labels";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { useRefresh } from "@/hooks/use-refresh";
import { addResidentRecordToBlacklistAction } from "@/server/resident-blacklist/resident-blacklist-actions";
import { type BlacklistEntry, findBlacklistEntry } from "@/server/resident-blacklist/resident-blacklist-repository";
import type { RelationshipOption, UnitOption } from "@/server/residents/add-resident-to-unit";
import { endResidentUnitLinkAction } from "@/server/residents/resident-actions";
import type { ResidentSummary, ResidentUnit } from "@/server/residents/resident-repository";

import { AddResidentDialog } from "./add-resident-dialog";
import { EditResidentDialog } from "./edit-resident-dialog";
import { ALL, communityOptions, filterResidents, type StatusFilter } from "./filter-residents";

function BlacklistStatus({
  entry,
  canAdd,
  canRemove,
  busy,
  onAdd,
  onRemove,
}: {
  entry: BlacklistEntry | undefined;
  canAdd: boolean;
  canRemove: boolean;
  busy: boolean;
  onAdd: () => void;
  onRemove: (entry: BlacklistEntry) => void;
}) {
  const linkClass = "h-auto p-0 text-muted-foreground text-xs";
  if (!entry) {
    return canAdd ? (
      <Button type="button" variant="link" size="sm" className={linkClass} disabled={busy} onClick={onAdd}>
        Agregar a blacklist
      </Button>
    ) : null;
  }
  return (
    <>
      <Pill tone="red">En blacklist</Pill>
      {canRemove && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className={linkClass}
          disabled={busy}
          onClick={() => onRemove(entry)}
        >
          Quitar de la blacklist
        </Button>
      )}
    </>
  );
}

// Same list design as Solicitudes (resident-requests-list).
// `manage` is null for VIEWER: no edit, add, end or blacklist actions.
// `blacklist` is null if it didn't load: no blacklist actions then.
export function ResidentsList({
  residents,
  manage,
  blacklist,
  canRemoveFromBlacklist,
}: {
  residents: ResidentSummary[];
  manage: { units: UnitOption[]; relationships: RelationshipOption[] } | null;
  blacklist: BlacklistEntry[] | null;
  canRemoveFromBlacklist: boolean;
}) {
  const canManage = manage !== null;
  const [search, setSearch] = React.useState("");
  const [communityId, setCommunityId] = React.useState(ALL);
  const [status, setStatus] = React.useState<StatusFilter>(ALL);
  const visibleResidents = filterResidents(residents, { search, communityId, status });
  const { refreshing, runAction } = useRefresh();
  const [ending, setEnding] = React.useState<{ resident: ResidentSummary; unit: ResidentUnit } | null>(null);
  const [blacklisting, setBlacklisting] = React.useState<ResidentSummary | null>(null);
  const [unblacklisting, setUnblacklisting] = React.useState<BlacklistEntry | null>(null);
  // Busy until the updated list is on screen.
  const busy = refreshing;

  function end({ resident, unit }: { resident: ResidentSummary; unit: ResidentUnit }) {
    runAction(
      () => endResidentUnitLinkAction(unit.linkId),
      (result) => {
        if (!result) {
          toast.error("No se pudo completar. Recargá la página y probá de nuevo.");
          return;
        }
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(`${resident.name} ya no es residente de la unidad ${unit.unitNumber ?? "s/n"}.`);
        setEnding(null);
      },
    );
  }

  function addToBlacklist(resident: ResidentSummary, reason: string) {
    runAction(
      () => addResidentRecordToBlacklistAction(resident.id, reason),
      (result) => {
        if (!result) {
          toast.error("No se pudo completar. Recargá la página y probá de nuevo.");
          return;
        }
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        toast.success(`${resident.name} quedó en la blacklist.`);
        setBlacklisting(null);
      },
    );
  }

  if (residents.length === 0) {
    return <ListEmpty>Todavía no hay residentes cargados.</ListEmpty>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <ListSearch
          aria-label="Buscar residente"
          placeholder="Buscar por nombre, teléfono o email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect
          label="Filtrar por consorcio"
          value={communityId}
          onChange={(event) => setCommunityId(event.target.value)}
        >
          <option value={ALL}>Consorcio: Todos</option>
          {communityOptions(residents).map((community) => (
            <option key={community.id} value={community.id}>
              Consorcio: {community.name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Filtrar por estado"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
        >
          <option value={ALL}>Estado: Todos</option>
          <option value="activos">Estado: Activos</option>
          <option value="inactivos">Estado: Inactivos</option>
        </FilterSelect>
        <ListCount count={residents.length} singular="residente" plural="residentes" />
      </div>

      {visibleResidents.length === 0 ? (
        <ListEmpty>No hay residentes que coincidan con la búsqueda.</ListEmpty>
      ) : (
        <ListTable>
          <TableHeader>
            <TableRow>
              <ListHead>Residente</ListHead>
              <ListHead>Contacto</ListHead>
              <ListHead>Consorcio / Unidad</ListHead>
              <ListHead>Relación</ListHead>
              <ListHead>Estado</ListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleResidents.map((resident) => (
              <TableRow key={resident.id}>
                <ListCell>
                  <div className="flex items-center gap-1">
                    <InitialsAvatar name={resident.name} index={residents.indexOf(resident)} />
                    {canManage && <EditResidentDialog resident={resident} />}
                  </div>
                </ListCell>
                <ListCell muted>
                  <p>{resident.phone ?? "Sin teléfono"}</p>
                  <p>{resident.email ?? "Sin email"}</p>
                </ListCell>
                <ListCell muted wrap>
                  {resident.units.length === 0 ? (
                    <p>Sin unidad</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {resident.units.map((unit) => (
                        <li key={unit.unitId}>
                          <Link
                            href={`/dashboard/consorcios?consorcio=${unit.communityId}`}
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                          >
                            {unit.communityName}
                          </Link>
                          <p>
                            Unidad {unit.unitNumber ?? "s/n"}
                            {unit.isPrimary && " · Principal"}
                          </p>
                          {manage && (
                            <Button
                              type="button"
                              variant="link"
                              size="sm"
                              className="h-auto p-0 text-muted-foreground text-xs"
                              disabled={busy}
                              onClick={() => setEnding({ resident, unit })}
                            >
                              Dar de baja
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {manage && (
                    <AddResidentDialog units={manage.units} relationships={manage.relationships} resident={resident} />
                  )}
                </ListCell>
                <ListCell>
                  <div className="flex flex-col items-start gap-1.5">
                    {resident.units.map((unit) => (
                      <Pill key={unit.unitId} tone={relationshipTone(unit.relationship)}>
                        {relationshipLabel(unit.relationship) ?? "Sin definir"}
                      </Pill>
                    ))}
                  </div>
                </ListCell>
                <ListCell>
                  <div className="flex flex-col items-start gap-1.5">
                    <Pill tone={resident.active ? "green" : "neutral"}>{resident.active ? "Activo" : "Inactivo"}</Pill>
                    {blacklist && (
                      <BlacklistStatus
                        entry={findBlacklistEntry(resident, blacklist)}
                        canAdd={canManage && Boolean(resident.email || resident.phone)}
                        canRemove={canRemoveFromBlacklist}
                        busy={busy}
                        onAdd={() => setBlacklisting(resident)}
                        onRemove={setUnblacklisting}
                      />
                    )}
                  </div>
                </ListCell>
              </TableRow>
            ))}
          </TableBody>
        </ListTable>
      )}

      <BlacklistDialog
        contact={blacklisting}
        note="Sigue siendo residente de sus unidades."
        busy={busy}
        onConfirm={(reason) => blacklisting && addToBlacklist(blacklisting, reason)}
        onClose={() => setBlacklisting(null)}
      />

      <RemoveFromBlacklistDialog entry={unblacklisting} onClose={() => setUnblacklisting(null)} />

      <AlertDialog open={ending !== null} onOpenChange={(open) => !open && !busy && setEnding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dar de baja de la unidad</AlertDialogTitle>
            <AlertDialogDescription>
              {ending?.resident.name} deja de ser residente de la unidad {ending?.unit.unitNumber ?? "s/n"} de{" "}
              {ending?.unit.communityName}. Si no tiene otras unidades, queda inactivo y el bot deja de reconocerlo. Si
              vuelve, puede pedir el alta de nuevo por Join.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                if (ending) end(ending);
              }}
            >
              {busy ? "Dando de baja…" : "Dar de baja"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
