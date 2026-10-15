"use client";

import * as React from "react";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { ListCell, ListHead, ListTable, Pill, type Tone } from "@/app/(main)/dashboard/_components/list-table";
import { Button } from "@/components/ui/button";
import { TableBody, TableHeader, TableRow } from "@/components/ui/table";
import type { CommunityTicket } from "@/server/communities/community-repository";

import { paginate } from "./paginate";

const PAGE_SIZE = 10;
const TICKET_STATUS_LABELS: Record<string, string> = { abierto: "Abierto", en_proceso: "En proceso" };
const TICKET_STATUS_TONES: Record<string, Tone> = { abierto: "amber", en_proceso: "blue" };

export function ActiveTicketsTable({ tickets }: { tickets: CommunityTicket[] }) {
  const [page, setPage] = React.useState(1);
  const current = paginate(tickets, page, PAGE_SIZE);

  return (
    <div className="space-y-4">
      <ListTable>
        <TableHeader>
          <TableRow>
            <ListHead>Código</ListHead>
            <ListHead desktopOnly>Unidad</ListHead>
            <ListHead>Descripción</ListHead>
            <ListHead desktopOnly>Fecha</ListHead>
            <ListHead>Estado</ListHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {current.items.map((ticket) => (
            <TableRow key={ticket.id}>
              <ListCell>
                <p className="font-semibold">{ticket.code}</p>
                <p className="text-muted-foreground text-xs md:hidden">
                  {[ticket.unitNumber, new Date(ticket.createdAt).toLocaleDateString("es-AR")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </ListCell>
              <ListCell muted desktopOnly>
                {ticket.unitNumber ?? "—"}
              </ListCell>
              <ListCell muted wrap>
                {ticket.description ?? "Sin descripción"}
              </ListCell>
              <ListCell muted desktopOnly>
                {new Date(ticket.createdAt).toLocaleDateString("es-AR")}
              </ListCell>
              <ListCell>
                <Pill tone={TICKET_STATUS_TONES[ticket.status] ?? "neutral"}>
                  {TICKET_STATUS_LABELS[ticket.status] ?? ticket.status}
                </Pill>
              </ListCell>
            </TableRow>
          ))}
        </TableBody>
      </ListTable>

      {current.pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label="Página anterior"
            disabled={current.page === 1}
            onClick={() => setPage(current.page - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-muted-foreground text-sm tabular-nums">
            {current.page} de {current.pageCount}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Página siguiente"
            disabled={current.page === current.pageCount}
            onClick={() => setPage(current.page + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
