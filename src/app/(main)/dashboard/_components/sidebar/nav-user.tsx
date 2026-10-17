"use client";

import { EllipsisVertical } from "lucide-react";

import { FiscalAlertDot } from "@/app/(main)/dashboard/_components/fiscal-chat/fiscal-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/utils";
import type { DeskPlanMenuData } from "@/server/desk-account";

import { TenantAccountMenu } from "./tenant-account-menu";

export function NavUser({
  user,
  logoutAction,
  planMenu,
}: {
  readonly user: { readonly name: string; readonly email: string; readonly avatar: string };
  readonly logoutAction: () => Promise<void>;
  readonly planMenu: DeskPlanMenuData;
}) {
  const { isMobile } = useSidebar();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <TenantAccountMenu
          user={user}
          logoutAction={logoutAction}
          planMenu={planMenu}
          side={isMobile ? "bottom" : "right"}
          trigger={
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="relative isolate shrink-0">
                <Avatar className="h-8 w-8 rounded-lg grayscale">
                  <AvatarImage src={user.avatar || undefined} alt={user.name} />
                  <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <FiscalAlertDot className="-right-1.5 -top-1.5 absolute" />
              </span>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-muted-foreground text-xs">{user.email}</span>
              </div>
              <EllipsisVertical className="ml-auto size-4" />
            </SidebarMenuButton>
          }
        />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
