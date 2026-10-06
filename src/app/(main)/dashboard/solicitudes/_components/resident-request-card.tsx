import { CalendarDays, Ellipsis, Mail, Phone } from "lucide-react";

import { Initials, ListActionButton, Pill } from "@/app/(main)/dashboard/_components/list-table";
import { relationshipLabel, relationshipTone } from "@/app/(main)/dashboard/consorcios/_components/community-labels";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ResidentRequest } from "@/server/resident-requests/resident-request-repository";

import { isNewRequest, requestedAgo } from "./request-time";

const dateTimeFormat = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function ResidentRequestCard({ request, index, now }: { request: ResidentRequest; index: number; now: number }) {
  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start gap-3">
        <Initials name={request.name} index={index} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-semibold">{request.name}</p>
          <p className="truncate text-muted-foreground text-sm">
            Unidad {request.unitNumber ?? "s/n"} · {request.communityName}
          </p>
          <Pill tone={relationshipTone(request.relationship)}>
            {relationshipLabel(request.relationship) ?? "Sin definir"}
          </Pill>
        </div>
        <div className="flex items-center gap-2">
          {isNewRequest(request.createdAt, now) && (
            <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400">
              NEW
            </Badge>
          )}
          <ListActionButton size="icon" aria-label="Más acciones">
            <Ellipsis className="size-4" />
          </ListActionButton>
        </div>
      </div>

      <ul className="space-y-2 text-muted-foreground text-sm">
        <li className="flex items-center gap-2.5">
          <Mail className="size-4 shrink-0" />
          <span className="truncate">{request.email}</span>
        </li>
        <li className="flex items-center gap-2.5">
          <Phone className="size-4 shrink-0" />
          <span>{request.phone ?? "Sin teléfono"}</span>
        </li>
        <li className="flex items-start gap-2.5">
          <CalendarDays className="mt-0.5 size-4 shrink-0" />
          {/* The relative time depends on the clock; server and browser can differ by a minute. */}
          <span suppressHydrationWarning>
            Solicitó acceso {requestedAgo(request.createdAt, now)}
            <br />
            {dateTimeFormat.format(new Date(request.createdAt)).replace(",", "")}
          </span>
        </li>
      </ul>
    </Card>
  );
}
