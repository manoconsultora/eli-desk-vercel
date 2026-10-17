"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { Search } from "lucide-react";

import { useDeskNavigationState } from "@/app/(main)/dashboard/_components/desk-access-context";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { type DeskNavigationItem, deskNavigationItems } from "@/navigation/sidebar/sidebar-items";

const searchGroups = [
  { id: "primary", label: "ELI Desk" },
  { id: "future", label: "Próximamente" },
] as const;

function AvailabilityLabel({ state }: { state: "resolved" | "coming_soon" | "unavailable" }) {
  if (state === "resolved") return null;

  return (
    <span className="ml-2 rounded-md bg-muted px-2 py-1 text-xs">
      {state === "coming_soon" ? "Próximamente" : "No disponible"}
    </span>
  );
}

function SearchNavigationItem({ item, onSelect }: { item: DeskNavigationItem; onSelect: (href: string) => void }) {
  const Icon = item.icon;
  const state = useDeskNavigationState(item.featureId);
  if (state === "denied" || state === "unavailable" || state === "error") return null;
  const isAvailable = state === "resolved" && Boolean(item.href);

  return (
    <CommandItem
      disabled={!isAvailable}
      className={!isAvailable ? "opacity-60" : undefined}
      onSelect={() => {
        if (isAvailable && item.href) onSelect(item.href);
      }}
    >
      <Icon />
      <span className="flex-1">{item.label}</span>
      <AvailabilityLabel state={state} />
    </CommandItem>
  );
}

export function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function down(event: KeyboardEvent) {
      if (event.key === "j" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
    }

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <>
      <Button
        variant="link"
        className="!px-0 font-normal text-muted-foreground hover:no-underline"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4" />
        Buscar
        <kbd className="inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-medium text-[10px]">
          <span className="text-xs">⌘</span>J
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar módulos de ELI Desk…" />
        <CommandList>
          <CommandEmpty>No se encontraron resultados.</CommandEmpty>
          {searchGroups.map((group, index) => {
            const items = deskNavigationItems.filter((item) => item.desktopSection === group.id);

            return (
              <React.Fragment key={group.id}>
                {index !== 0 && <CommandSeparator />}
                <CommandGroup heading={group.label}>
                  {items.map((item) => (
                    <SearchNavigationItem
                      key={item.id}
                      item={item}
                      onSelect={(href) => {
                        router.push(href);
                        setOpen(false);
                      }}
                    />
                  ))}
                </CommandGroup>
              </React.Fragment>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
}
