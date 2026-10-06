"use client";

import * as React from "react";

import Link from "next/link";

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
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import type { ResidentSummary } from "@/server/residents/resident-repository";

import { ALL, communityOptions, filterResidents, type StatusFilter } from "./filter-residents";

// Same list design as Solicitudes (resident-requests-list).
export function ResidentsList({ residents }: { residents: ResidentSummary[] }) {
  const [search, setSearch] = React.useState("");
  const [communityId, setCommunityId] = React.useState(ALL);
  const [status, setStatus] = React.useState<StatusFilter>(ALL);
  const visibleResidents = filterResidents(residents, { search, communityId, status });

  if (residents.length === 0) {
    return <ListEmpty>Todavía no hay residentes cargados.</ListEmpty>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
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
                  <InitialsAvatar name={resident.name} index={residents.indexOf(resident)} />
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
                        </li>
                      ))}
                    </ul>
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
                  <Pill tone={resident.active ? "green" : "neutral"}>{resident.active ? "Activo" : "Inactivo"}</Pill>
                </ListCell>
              </TableRow>
            ))}
          </TableBody>
        </ListTable>
      )}
    </div>
  );
}
