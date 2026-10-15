"use client";

import Image from "next/image";
import Link from "next/link";

import { useShallow } from "zustand/react/shallow";

import { ConsorcioContext } from "@/app/(main)/dashboard/_components/consorcio-context";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { deskDesktopNavigationItems } from "@/navigation/sidebar/sidebar-items";
import type { DeskPlanMenuData } from "@/server/desk-account";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar({
  currentUser,
  logoutAction,
  planMenu,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatar: string;
  };
  logoutAction: () => Promise<void>;
  planMenu: DeskPlanMenuData;
}) {
  const { sidebarVariant, sidebarCollapsible, isSynced } = usePreferencesStore(
    useShallow((s) => ({
      sidebarVariant: s.sidebarVariant,
      sidebarCollapsible: s.sidebarCollapsible,
      isSynced: s.isSynced,
    })),
  );

  const variant = isSynced ? sidebarVariant : props.variant;
  const collapsible = isSynced ? sidebarCollapsible : props.collapsible;

  return (
    <Sidebar {...props} variant={variant} collapsible={collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link prefetch={false} href="/dashboard/default">
                <Image src="/logo_eli.svg" alt="ELI" width={112} height={32} className="h-auto w-28 dark:hidden" />
                <Image
                  src="/logo_eli_w.svg"
                  alt="ELI"
                  width={112}
                  height={32}
                  className="hidden h-auto w-28 dark:block"
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 py-2">
          <ConsorcioContext />
        </div>
        <NavMain items={deskDesktopNavigationItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={currentUser} logoutAction={logoutAction} planMenu={planMenu} />
      </SidebarFooter>
    </Sidebar>
  );
}
