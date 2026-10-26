"use client";

import * as React from "react";

import { CalendarDays, Mail, MessageSquareText, Phone } from "lucide-react";

import { RemoveFromBlacklistDialog } from "@/app/(main)/dashboard/_components/blacklist-dialogs";
import { Initials, ListEmpty } from "@/app/(main)/dashboard/_components/list-table";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BlacklistEntry } from "@/server/resident-blacklist/resident-blacklist-repository";

import { formatRequestDate } from "./request-time";

export function BlacklistList({
  entries,
  canRemove,
  isFiltered,
}: {
  entries: BlacklistEntry[] | null;
  canRemove: boolean;
  isFiltered: boolean;
}) {
  const [removing, setRemoving] = React.useState<BlacklistEntry | null>(null);

  if (entries === null) return <ListEmpty>No se pudo cargar la blacklist. Probá de nuevo en unos minutos.</ListEmpty>;
  if (entries.length === 0) {
    return (
      <ListEmpty>
        {isFiltered ? "No hay contactos que coincidan con la búsqueda." : "No hay contactos en la blacklist."}
      </ListEmpty>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entries.map((entry, index) => (
          <Card key={entry.id} className="gap-4 p-5">
            <div className="flex items-center gap-3">
              <Initials name={entry.name} index={index} />
              <p className="truncate font-semibold">{entry.name}</p>
            </div>
            <ul className="space-y-2 text-muted-foreground text-sm">
              <li className="flex items-center gap-2.5">
                <Mail className="size-4 shrink-0" />
                <span className="truncate">{entry.email ?? "Sin email"}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="size-4 shrink-0" />
                <span>{entry.phone ?? "Sin teléfono"}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <CalendarDays className="size-4 shrink-0" />
                <span>Agregado el {formatRequestDate(entry.createdAt)}</span>
              </li>
              {entry.reason && (
                <li className="flex items-start gap-2.5">
                  <MessageSquareText className="mt-0.5 size-4 shrink-0" />
                  <span>{entry.reason}</span>
                </li>
              )}
            </ul>
            {canRemove && (
              <Button type="button" variant="outline" onClick={() => setRemoving(entry)}>
                Quitar de la blacklist
              </Button>
            )}
          </Card>
        ))}
      </div>

      <RemoveFromBlacklistDialog entry={removing} onClose={() => setRemoving(null)} />
    </>
  );
}
