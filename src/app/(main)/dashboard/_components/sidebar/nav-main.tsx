"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

import { useDeskNavigationState } from "@/app/(main)/dashboard/_components/desk-access-context";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import type { DeskNavigationItem } from "@/navigation/sidebar/sidebar-items";

function AvailabilityLabel({ state }: { state: "resolved" | "coming_soon" | "unavailable" }) {
  return <span className="ml-auto text-xs">{state === "coming_soon" ? "Próximamente" : "No disponible"}</span>;
}

// Must render inside the Link: shows the item is loading from the moment it is clicked.
function PendingIndicator() {
  const { pending } = useLinkStatus();
  return pending ? <Spinner className="ml-auto" /> : null;
}

function DeskNavItem({ item, pathname }: { item: DeskNavigationItem; pathname: string }) {
  const Icon = item.icon;
  const href = item.href;
  const state = useDeskNavigationState(item.featureId);
  if (state === "denied" || state === "unavailable" || state === "error") return null;
  const isAvailable = state === "resolved" && Boolean(href);
  const isActive = isAvailable && pathname === item.href;

  return (
    <SidebarMenuItem>
      {isAvailable && href ? (
        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
          <Link prefetch={false} href={href}>
            <Icon />
            <span>{item.label}</span>
            <PendingIndicator />
          </Link>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton disabled aria-disabled="true" tooltip={item.label}>
          <Icon />
          <span>{item.label}</span>
          <AvailabilityLabel state={state} />
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

export function NavMain({ items }: { readonly items: readonly DeskNavigationItem[] }) {
  const pathname = usePathname();
  const primaryItems = items.filter((item) => item.desktopSection === "primary");
  const futureItems = items.filter((item) => item.desktopSection === "future");

  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>ELI Desk</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {primaryItems.map((item) => (
              <DeskNavItem key={item.id} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Próximamente</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {futureItems.map((item) => (
              <DeskNavItem key={item.id} item={item} pathname={pathname} />
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
