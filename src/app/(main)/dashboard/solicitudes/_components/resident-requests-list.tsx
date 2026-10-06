"use client";

import * as React from "react";

import { Ellipsis, Eye } from "lucide-react";

import {
  FilterSelect,
  InitialsAvatar,
  ListActionButton,
  ListCell,
  ListCount,
  ListEmpty,
  ListHead,
  ListSearch,
  ListTable,
  Pill,
  type Tone,
} from "@/app/(main)/dashboard/_components/list-table";
import { relationshipLabel, relationshipTone } from "@/app/(main)/dashboard/consorcios/_components/community-labels";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import type { ResidentRequest } from "@/server/resident-requests/resident-request-repository";

const ALL = "todos";
// status is free text in the DB; unknown values fall back to a readable label and a neutral pill.
const STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: "Pendiente",
};
const STATUS_TONES: Record<string, Tone> = {
  PENDING_VERIFICATION: "amber",
};
const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" });

function statusLabel(status: string) {
  const text = status.replaceAll("_", " ").trim().toLowerCase();
  return STATUS_LABELS[status] ?? text.charAt(0).toUpperCase() + text.slice(1);
}

export function ResidentRequestsList({ requests }: { requests: ResidentRequest[] }) {
  const [search, setSearch] = React.useState("");
  const [community, setCommunity] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);

  const query = search.trim().toLowerCase();
  const communities = [...new Set(requests.map((request) => request.communityName))].sort();
  const statuses = [...new Set(requests.map((request) => request.status))];
  const visibleRequests = requests.filter(
    (request) =>
      (!query || [request.name, request.phone, request.email].some((value) => value?.toLowerCase().includes(query))) &&
      (community === ALL || request.communityName === community) &&
      (status === ALL || request.status === status),
  );

  if (requests.length === 0) {
    return <ListEmpty>Todavía no hay solicitudes.</ListEmpty>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <ListSearch
          aria-label="Buscar solicitud"
          placeholder="Buscar por nombre, teléfono o email…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect
          label="Filtrar por consorcio"
          value={community}
          onChange={(event) => setCommunity(event.target.value)}
        >
          <option value={ALL}>Consorcio: Todos</option>
          {communities.map((name) => (
            <option key={name} value={name}>
              Consorcio: {name}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value={ALL}>Estado: Todos</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              Estado: {statusLabel(value)}
            </option>
          ))}
        </FilterSelect>
        <ListCount count={requests.length} singular="solicitud" plural="solicitudes" />
      </div>

      {visibleRequests.length === 0 ? (
        <ListEmpty>No hay solicitudes que coincidan con la búsqueda.</ListEmpty>
      ) : (
        <ListTable>
          <TableHeader>
            <TableRow>
              <ListHead>Solicitante</ListHead>
              <ListHead>Contacto</ListHead>
              <ListHead>Consorcio / Unidad</ListHead>
              <ListHead>Relación</ListHead>
              <ListHead>Recibida</ListHead>
              <ListHead>Estado</ListHead>
              <ListHead>Acciones</ListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRequests.map((request) => (
              <TableRow key={request.id}>
                <ListCell>
                  <InitialsAvatar name={request.name} index={requests.indexOf(request)} />
                </ListCell>
                <ListCell muted>
                  <p>{request.phone ?? "Sin teléfono"}</p>
                  <p>{request.email}</p>
                </ListCell>
                <ListCell muted>
                  <p className="font-medium text-foreground">{request.communityName}</p>
                  <p>Unidad {request.unitNumber ?? "s/n"}</p>
                </ListCell>
                <ListCell>
                  <Pill tone={relationshipTone(request.relationship)}>
                    {relationshipLabel(request.relationship) ?? "Sin definir"}
                  </Pill>
                </ListCell>
                <ListCell muted>{dateFormat.format(new Date(request.createdAt))}</ListCell>
                <ListCell>
                  <Pill tone={STATUS_TONES[request.status] ?? "neutral"}>{statusLabel(request.status)}</Pill>
                </ListCell>
                <ListCell>
                  <div className="flex items-center gap-3">
                    <ListActionButton>
                      <Eye className="size-4" />
                      Ver
                    </ListActionButton>
                    <ListActionButton size="icon" aria-label="Más acciones">
                      <Ellipsis className="size-4" />
                    </ListActionButton>
                  </div>
                </ListCell>
              </TableRow>
            ))}
          </TableBody>
        </ListTable>
      )}
    </div>
  );
}
