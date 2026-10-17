"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { DeskPlanMenuData } from "@/server/desk-account";

import { FiscalAlertDot } from "../fiscal-chat/fiscal-provider";
import { TenantAccountMenu } from "./tenant-account-menu";

export function AccountSwitcher({
  user,
  logoutAction,
  planMenu,
}: {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
  readonly logoutAction: () => Promise<void>;
  readonly planMenu: DeskPlanMenuData;
}) {
  return (
    <TenantAccountMenu
      user={user}
      logoutAction={logoutAction}
      planMenu={planMenu}
      trigger={
        <button
          type="button"
          className="relative rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Abrir menú de usuario"
        >
          <Avatar className="relative size-9 cursor-pointer rounded-lg">
            <AvatarImage src={user.avatar || undefined} alt={user.name} />
            <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          <FiscalAlertDot className="-right-1.5 -top-1.5 absolute" />
        </button>
      }
    />
  );
}
