"use client";

import * as React from "react";

import Link from "next/link";

import { Eye } from "lucide-react";

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
import { communityStatusLabel } from "@/app/(main)/dashboard/consorcios/_components/community-labels";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import type { CommunitySummary } from "@/server/communities/community-repository";

const ALL = "todos";
const STATUS_TONES: Record<string, Tone> = { activo: "green" };

export function CommunityStatusPill({ status }: { status: string | null }) {
  return (
    <Pill tone={STATUS_TONES[status?.toLowerCase() ?? ""] ?? "neutral"}>
      {communityStatusLabel(status) ?? "Sin definir"}
    </Pill>
  );
}

export function CommunitiesList({ communities }: { communities: CommunitySummary[] }) {
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState(ALL);

  const query = search.trim().toLowerCase();
  const statuses = [...new Set(communities.flatMap((community) => community.status ?? []))];
  const visibleCommunities = communities.filter(
    (community) =>
      (!query || [community.name, community.address].some((value) => value.toLowerCase().includes(query))) &&
      (status === ALL || community.status === status),
  );

  if (communities.length === 0) {
    return <ListEmpty>Todavía no hay consorcios cargados.</ListEmpty>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <ListSearch
          aria-label="Buscar consorcio"
          placeholder="Buscar por nombre o dirección…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <FilterSelect label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value={ALL}>Estado: Todos</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              Estado: {communityStatusLabel(value)}
            </option>
          ))}
        </FilterSelect>
        <ListCount count={communities.length} singular="consorcio" plural="consorcios" />
      </div>

      {visibleCommunities.length === 0 ? (
        <ListEmpty>No hay consorcios que coincidan con la búsqueda.</ListEmpty>
      ) : (
        <ListTable>
          <TableHeader>
            <TableRow>
              <ListHead>Consorcio</ListHead>
              <ListHead>Dirección</ListHead>
              <ListHead>Unidades</ListHead>
              <ListHead>Tickets activos</ListHead>
              <ListHead>Estado</ListHead>
              <ListHead>Acciones</ListHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleCommunities.map((community) => (
              <TableRow key={community.id}>
                <ListCell>
                  <InitialsAvatar name={community.name} index={communities.indexOf(community)} />
                </ListCell>
                <ListCell muted>{community.address}</ListCell>
                <ListCell>{community.unitCount}</ListCell>
                <ListCell>
                  <Pill tone={community.activeTicketCount > 0 ? "red" : "neutral"}>{community.activeTicketCount}</Pill>
                </ListCell>
                <ListCell>
                  <CommunityStatusPill status={community.status} />
                </ListCell>
                <ListCell>
                  <ListActionButton asChild>
                    <Link href={`/dashboard/consorcios?consorcio=${community.id}`} scroll={false}>
                      <Eye className="size-4" />
                      Ver
                    </Link>
                  </ListActionButton>
                </ListCell>
              </TableRow>
            ))}
          </TableBody>
        </ListTable>
      )}
    </div>
  );
}
