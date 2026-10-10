import type * as React from "react";

import { CalendarDays, Mail, Phone } from "lucide-react";

import { Initials, Pill } from "@/app/(main)/dashboard/_components/list-table";
import { relationshipLabel, relationshipTone } from "@/app/(main)/dashboard/consorcios/_components/community-labels";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ResidentRequest } from "@/server/resident-requests/resident-request-repository";

import { EmailDeliveryNote } from "./email-delivery";
import { formatRequestDate, isNewRequest, requestedAgo } from "./request-time";

export function ResidentRequestCard({
  request,
  index,
  now,
  selected,
  onSelect,
  actions,
}: {
  request: ResidentRequest;
  index: number;
  now: number;
  selected: boolean;
  onSelect: () => void;
  actions?: React.ReactNode;
}) {
  return (
    <Card
      className={cn("relative gap-4 p-5 transition-colors hover:border-blue-500/50", selected && "border-blue-500")}
    >
      {/* Covers the whole card, so the card opens the detail without nesting content in a button. */}
      <button
        type="button"
        aria-label={`Ver solicitud de ${request.name}`}
        className="absolute inset-0 cursor-pointer rounded-xl"
        onClick={onSelect}
      />
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
        {isNewRequest(request.createdAt, now) && (
          <Badge variant="outline" className="border-blue-500/30 text-blue-700 dark:text-blue-400">
            NEW
          </Badge>
        )}
      </div>

      <ul className="space-y-2 text-muted-foreground text-sm">
        <li className="flex items-start gap-2.5">
          <Mail className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="block truncate">{request.email}</span>
            <EmailDeliveryNote delivery={request.emailDelivery} />
          </span>
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
            {formatRequestDate(request.createdAt)}
          </span>
        </li>
      </ul>

      {/* Above the card's cover button, so the actions get the click. */}
      {actions && <div className="relative z-10 grid grid-cols-2 gap-3">{actions}</div>}
    </Card>
  );
}
