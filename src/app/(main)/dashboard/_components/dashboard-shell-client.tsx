"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { ConsorcioContext } from "@/app/(main)/dashboard/_components/consorcio-context";
import { DeskAccessProvider, useDeskNavigationState } from "@/app/(main)/dashboard/_components/desk-access-context";
import { AppSidebar } from "@/app/(main)/dashboard/_components/sidebar/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { deskMobilePrimaryItems } from "@/navigation/sidebar/sidebar-items";
import type { DeskFeatureAccessPresentation } from "@/server/access/resolve-desk-feature-access";
import type { DeskPlanMenuData } from "@/server/desk-account";

import { MobileMoreMenu } from "./mobile-more-menu";
import { AccountSwitcher } from "./sidebar/account-switcher";
import { LayoutControls } from "./sidebar/layout-controls";
import { SearchDialog } from "./sidebar/search-dialog";
import { ThemeSwitcher } from "./sidebar/theme-switcher";
import { TicketRslProvider } from "./ticket-rsl-provider";

type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatar: string;
};

type DashboardShellClientProps = {
  defaultOpen: boolean;
  variant: "inset" | "sidebar" | "floating";
  collapsible: "offcanvas" | "icon" | "none";
  currentUser: CurrentUser;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
  deskAccess: readonly DeskFeatureAccessPresentation[];
  planMenu: DeskPlanMenuData;
  deploymentVersion: string;
  ticketRealtimeScope: {
    organizationId: string | null;
    consorcioIds: readonly string[];
  };
};

type DashboardUserContextValue = Pick<DashboardShellClientProps, "currentUser" | "logoutAction" | "planMenu">;

const DashboardUserContext = React.createContext<DashboardUserContextValue | null>(null);

export function useDashboardUser() {
  const context = React.useContext(DashboardUserContext);

  if (!context) {
    throw new Error("useDashboardUser must be used within DashboardShellClient.");
  }

  return context;
}

function MobileBottomNavItem({ item, pathname }: { item: (typeof deskMobilePrimaryItems)[number]; pathname: string }) {
  const Icon = item.icon;
  const href = item.href;
  const state = useDeskNavigationState(item.featureId);
  if (state === "denied" || state === "unavailable" || state === "error") return null;
  const isAvailable = state === "resolved" && Boolean(href);
  const isActive = isAvailable && pathname === item.href;

  return isAvailable && href ? (
    <Link
      key={item.id}
      href={href}
      className={cn(
        "flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 font-medium text-[11px] text-muted-foreground transition-all",
        isActive && "bg-primary text-primary-foreground shadow-[0_10px_30px_-14px_rgba(37,99,235,0.95)]",
      )}
    >
      <Icon className="size-5" />
      <span className="truncate">{item.label}</span>
    </Link>
  ) : (
    <button
      key={item.id}
      type="button"
      disabled
      className="flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-2 font-medium text-[11px] text-muted-foreground opacity-60"
    >
      <Icon className="size-5" />
      <span className="truncate">{item.label}</span>
      <span className="font-normal text-[9px] leading-none">No disponible</span>
    </button>
  );
}

function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-between rounded-[1.75rem] border border-border/60 bg-background/92 p-2 shadow-[0_18px_60px_-20px_rgba(15,23,42,0.4)] backdrop-blur-2xl">
        {deskMobilePrimaryItems.map((item) => (
          <MobileBottomNavItem key={item.id} item={item} pathname={pathname} />
        ))}
        <MobileMoreMenu />
      </div>
    </div>
  );
}

export function DashboardShellClient({
  defaultOpen,
  variant,
  collapsible,
  currentUser,
  logoutAction,
  deskAccess,
  planMenu,
  deploymentVersion,
  ticketRealtimeScope,
  children,
}: DashboardShellClientProps) {
  const [mounted, setMounted] = React.useState(false);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const content = !mounted ? (
    <div className="flex min-h-dvh flex-col">
      <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
    </div>
  ) : isMobile ? (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#fffdf8_0%,#f7f8fc_58%,#f3f6fb_100%)]">
      <header className="mx-auto flex max-w-md items-center justify-between gap-3 px-4 pt-5">
        <div className="min-w-0 flex-1">
          <ConsorcioContext />
        </div>
        <AccountSwitcher user={currentUser} logoutAction={logoutAction} planMenu={planMenu} />
      </header>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-4 pb-28">{children}</main>
      <MobileBottomNav />
    </div>
  ) : (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar
        currentUser={currentUser}
        variant={variant}
        collapsible={collapsible}
        logoutAction={logoutAction}
        planMenu={planMenu}
        deploymentVersion={deploymentVersion}
      />
      <SidebarInset
        className={cn(
          "[html[data-content-layout=centered]_&]:mx-auto! [html[data-content-layout=centered]_&]:max-w-screen-2xl!",
          "max-[113rem]:peer-data-[variant=inset]:mr-2! min-[101rem]:peer-data-[variant=inset]:peer-data-[state=collapsed]:mr-auto!",
        )}
      >
        <header
          className={cn(
            "flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12",
            "[html[data-navbar-style=sticky]_&]:sticky [html[data-navbar-style=sticky]_&]:top-0 [html[data-navbar-style=sticky]_&]:z-50 [html[data-navbar-style=sticky]_&]:overflow-hidden [html[data-navbar-style=sticky]_&]:rounded-t-[inherit] [html[data-navbar-style=sticky]_&]:bg-background/50 [html[data-navbar-style=sticky]_&]:backdrop-blur-md",
          )}
        >
          <div className="flex w-full items-center justify-between px-4 lg:px-6">
            <div className="flex items-center gap-1 lg:gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
              <SearchDialog />
            </div>
            <div className="flex items-center gap-2">
              <LayoutControls />
              <ThemeSwitcher />
              <AccountSwitcher user={currentUser} logoutAction={logoutAction} planMenu={planMenu} />
            </div>
          </div>
        </header>
        <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );

  return (
    <DeskAccessProvider value={deskAccess}>
      <DashboardUserContext.Provider value={{ currentUser, logoutAction, planMenu }}>
        <TicketRslProvider
          organizationId={ticketRealtimeScope.organizationId}
          consorcioIds={ticketRealtimeScope.consorcioIds}
        >
          {content}
        </TicketRslProvider>
      </DashboardUserContext.Provider>
    </DeskAccessProvider>
  );
}
