"use client";

import * as React from "react";

import { Ellipsis } from "lucide-react";

import { useDeskNavigationState } from "@/app/(main)/dashboard/_components/desk-access-context";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  DESK_MOBILE_MORE_LABEL,
  type DeskNavigationItem,
  deskMobileMoreItems,
} from "@/navigation/sidebar/sidebar-items";

function AvailabilityLabel({ state }: { state: "resolved" | "coming_soon" | "unavailable" }) {
  return (
    <span className="text-muted-foreground text-xs">{state === "coming_soon" ? "Próximamente" : "No disponible"}</span>
  );
}

function MoreModuleItem({ item }: { item: DeskNavigationItem }) {
  const Icon = item.icon;
  const state = useDeskNavigationState(item.featureId);
  if (state === "denied" || state === "unavailable" || state === "error") return null;

  return (
    <div className="flex h-12 items-center gap-3 px-3 text-sm opacity-70">
      <Icon aria-hidden="true" className="size-5" />
      <span className="flex-1">{item.label}</span>
      <AvailabilityLabel state={state} />
    </div>
  );
}

export function MobileMoreMenu() {
  const [open, setOpen] = React.useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 font-medium text-[11px] text-muted-foreground transition-all",
            open && "bg-primary text-primary-foreground shadow-[0_10px_30px_-14px_rgba(37,99,235,0.95)]",
          )}
          aria-label={DESK_MOBILE_MORE_LABEL}
        >
          <Ellipsis aria-hidden="true" className="size-5" />
          <span className="truncate">{DESK_MOBILE_MORE_LABEL}</span>
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Más</DrawerTitle>
          <DrawerDescription>Navegación secundaria de ELI Desk</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-1 px-4 pb-3">
          {deskMobileMoreItems.map((item) => (
            <MoreModuleItem key={item.id} item={item} />
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
