"use client";

import * as React from "react";

import {
  FilterSelect,
  ListCell,
  ListEmpty,
  ListHead,
  ListSearch,
  ListTable,
  Pill,
  type Tone,
} from "@/app/(main)/dashboard/_components/list-table";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import type { CommunityUnit } from "@/server/communities/community-repository";

import { relationshipLabel, unitStatusLabel, unitTypeLabel } from "./community-labels";
import { EditUnitDialog } from "./edit-unit-dialog";
import { ALL, filterUnits, type ResidentsFilter, sortUnits, statusOptions } from "./filter-units";

const STATUS_TONES: Record<string, Tone> = { ocupado: "green" };

export function UnitsTable({ units, canManage }: { units: CommunityUnit[]; canManage: boolean }) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState(ALL);
  const [residents, setResidents] = React.useState<ResidentsFilter>(ALL);
  const visibleUnits = filterUnits(sortUnits(units), { search, status, residents });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <ListSearch
          aria-label="Buscar unidad o residente"
          placeholder="Buscar unidad o residente…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value={ALL}>Estado: Todos</option>
          {statusOptions(units).map((value) => (
            <option key={value} value={value}>
              Estado: {unitStatusLabel(value)}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect
          label="Filtrar por residentes"
          value={residents}
          onChange={(event) => setResidents(event.target.value as ResidentsFilter)}
        >
          <option value={ALL}>Residentes: Todas</option>
          <option value="con">Con residentes</option>
          <option value="sin">Sin residentes</option>
        </FilterSelect>
      </div>

      {visibleUnits.length === 0 ? (
        <ListEmpty>No hay unidades que coincidan con la búsqueda.</ListEmpty>
      ) : (
        <ListTable>
          <TableHeader>
            <TableRow>
              <ListHead>Unidad</ListHead>
              <ListHead desktopOnly>Piso</ListHead>
              <ListHead desktopOnly>Tipo</ListHead>
              <ListHead>Estado</ListHead>
              <ListHead>Residentes</ListHead>
              {canManage && (
                <ListHead>
                  <span className="sr-only">Acciones</span>
                </ListHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleUnits.map((unit) => (
              <TableRow key={unit.id}>
                <ListCell>
                  <p className="font-semibold">{unit.number ?? "s/n"}</p>
                  <p className="text-muted-foreground text-sm md:hidden">
                    {[unit.floor && `Piso ${unit.floor}`, unitTypeLabel(unit.type)].filter(Boolean).join(" · ")}
                  </p>
                </ListCell>
                <ListCell muted desktopOnly>
                  {unit.floor ?? "—"}
                </ListCell>
                <ListCell muted desktopOnly>
                  {unitTypeLabel(unit.type) ?? "—"}
                </ListCell>
                <ListCell>
                  {unit.status ? (
                    <Pill tone={STATUS_TONES[unit.status.toLowerCase()] ?? "neutral"}>
                      {unitStatusLabel(unit.status)}
                    </Pill>
                  ) : (
                    "—"
                  )}
                </ListCell>
                <ListCell wrap>
                  {unit.residents.length === 0 ? (
                    <span className="text-muted-foreground text-sm">Sin residentes</span>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {unit.residents.map((resident) => (
                        <li key={resident.id}>
                          <p className="font-medium">{resident.name}</p>
                          <p className="text-muted-foreground">
                            {[relationshipLabel(resident.relationship), resident.isPrimary && "Principal"]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </ListCell>
                {canManage && (
                  <ListCell>
                    <EditUnitDialog unit={unit} />
                  </ListCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </ListTable>
      )}
    </div>
  );
}
