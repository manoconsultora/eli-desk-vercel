"use client";

import * as React from "react";

import { Eye, LayoutGrid, List } from "lucide-react";

import {
  FilterSelect,
  InitialsAvatar,
  ListActionButton,
  ListCell,
  ListEmpty,
  ListHead,
  ListSearch,
  ListTable,
  Pill,
  type Tone,
} from "@/app/(main)/dashboard/_components/list-table";
import { relationshipLabel, relationshipTone } from "@/app/(main)/dashboard/consorcios/_components/community-labels";
import { Badge } from "@/components/ui/badge";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ResidentRequest } from "@/server/resident-requests/resident-request-repository";

import { ResidentRequestCard } from "./resident-request-card";

const ALL = "todos";
// status is free text in the DB; unknown values fall back to a readable label and a neutral pill.
const STATUS_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: "Pendiente",
  APPROVED: "Aceptada",
  REJECTED: "Rechazada",
};
const STATUS_TONES: Record<string, Tone> = {
  PENDING_VERIFICATION: "amber",
  APPROVED: "green",
  REJECTED: "red",
};
// One tab per review state. CANCELLED and EXPIRED requests have no tab.
const TABS = [
  {
    status: "PENDING_VERIFICATION",
    label: "Pendientes de aprobación",
    dot: "bg-amber-500",
    empty: "No hay solicitudes pendientes.",
  },
  { status: "APPROVED", label: "Activos", dot: "bg-green-500", empty: "Todavía no hay solicitudes aceptadas." },
  { status: "REJECTED", label: "Rechazados", dot: "bg-red-500", empty: "No hay solicitudes rechazadas." },
];
const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" });

function statusLabel(status: string) {
  const text = status.replaceAll("_", " ").trim().toLowerCase();
  return STATUS_LABELS[status] ?? text.charAt(0).toUpperCase() + text.slice(1);
}

export function ResidentRequestsList({ requests }: { requests: ResidentRequest[] }) {
  const [search, setSearch] = React.useState("");
  const [community, setCommunity] = React.useState(ALL);
  const [relationship, setRelationship] = React.useState(ALL);
  const [tab, setTab] = React.useState(TABS[0].status);
  const [view, setView] = React.useState<"cards" | "list">("cards");
  const [now] = React.useState(() => Date.now());

  const query = search.trim().toLowerCase();
  const communities = [...new Set(requests.map((request) => request.communityName))].sort();
  const relationships = [...new Set(requests.map((request) => request.relationship))];
  // Tab counts follow the search and filters, so they match what each tab shows.
  const filteredRequests = requests.filter(
    (request) =>
      (!query ||
        [request.name, request.phone, request.email, request.unitNumber].some((value) =>
          value?.toLowerCase().includes(query),
        )) &&
      (community === ALL || request.communityName === community) &&
      (relationship === ALL || request.relationship === relationship),
  );
  const visibleRequests = filteredRequests.filter((request) => request.status === tab);
  const isFiltered = Boolean(query) || community !== ALL || relationship !== ALL;

  if (requests.length === 0) {
    return <ListEmpty>Todavía no hay solicitudes.</ListEmpty>;
  }

  return (
    <div className="space-y-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto w-full flex-wrap justify-start md:w-fit">
          {TABS.map((item) => (
            <TabsTrigger key={item.status} value={item.status} className="gap-2 px-3 py-1.5">
              <span aria-hidden className={`size-2 rounded-full ${item.dot}`} />
              {item.label}
              <Badge variant="secondary">
                {filteredRequests.filter((request) => request.status === item.status).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <ListSearch
          aria-label="Buscar solicitud"
          placeholder="Buscar por nombre, email, teléfono o unidad…"
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
        <FilterSelect
          label="Filtrar por relación"
          value={relationship}
          onChange={(event) => setRelationship(event.target.value)}
        >
          <option value={ALL}>Relación: Todas</option>
          {relationships.map((value) => (
            <option key={value} value={value}>
              Relación: {relationshipLabel(value)}
            </option>
          ))}
        </FilterSelect>
        <ToggleGroup
          type="single"
          variant="outline"
          className="md:ml-auto"
          value={view}
          onValueChange={(value) => value && setView(value as "cards" | "list")}
        >
          <ToggleGroupItem value="cards" aria-label="Ver como tarjetas">
            <LayoutGrid />
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="Ver como lista">
            <List />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {visibleRequests.length === 0 ? (
        <ListEmpty>
          {isFiltered
            ? "No hay solicitudes que coincidan con la búsqueda."
            : TABS.find((item) => item.status === tab)?.empty}
        </ListEmpty>
      ) : view === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleRequests.map((request) => (
            <ResidentRequestCard key={request.id} request={request} index={requests.indexOf(request)} now={now} />
          ))}
        </div>
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
