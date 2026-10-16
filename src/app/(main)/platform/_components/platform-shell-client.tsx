"use client";

import * as React from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Ellipsis, LogOut, PanelLeft, UserRound } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { isPlatformNavigationActive } from "@/lib/platform-onboarding/route-policy";
import { cn, getInitials } from "@/lib/utils";
import {
  PLATFORM_MOBILE_MORE_LABEL,
  type PlatformNavigationItem,
  platformDesktopAdministrationItems,
  platformDesktopPrimaryItems,
  platformMobileMoreItems,
  platformMobilePrimaryItems,
} from "@/navigation/platform/platform-items";

type PlatformUser = {
  name: string;
  email: string;
  avatar: string;
  canAccessOnboarding: boolean;
};

type PlatformShellClientProps = {
  currentUser: PlatformUser;
  logoutAction: () => Promise<void>;
  children: React.ReactNode;
};

function AvailabilityLabel() {
  return <span className="ml-auto text-xs">No disponible</span>;
}

function PlatformNavigationButton({
  item,
  pathname,
  canAccessOnboarding,
}: {
  item: PlatformNavigationItem;
  pathname: string;
  canAccessOnboarding: boolean;
}) {
  const Icon = item.icon;
  if (item.id === "onboarding" && !canAccessOnboarding) return null;
  const isAvailable = item.availability === "available" && Boolean(item.href);
  const isActive = isAvailable && item.href ? isPlatformNavigationActive(pathname, item.href) : false;

  return (
    <SidebarMenuItem>
      {isAvailable && item.href ? (
        <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
          <Link prefetch={false} href={item.href}>
            <Icon />
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      ) : (
        <SidebarMenuButton disabled aria-disabled="true" tooltip={item.label}>
          <Icon />
          <span>{item.label}</span>
          <AvailabilityLabel />
        </SidebarMenuButton>
      )}
    </SidebarMenuItem>
  );
}

function PlatformAccountMenu({
  user,
  logoutAction,
  mobile = false,
}: {
  user: PlatformUser;
  logoutAction: () => Promise<void>;
  mobile?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {mobile ? (
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-2xl border border-border/70 bg-background/90 shadow-sm"
            aria-label="Abrir menú de usuario"
          >
            <Avatar className="size-8 rounded-xl">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback className="rounded-xl">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
          </button>
        ) : (
          <SidebarMenuButton size="lg" tooltip="Cuenta">
            <Avatar className="size-8 rounded-lg">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-muted-foreground text-xs">{user.email}</span>
            </div>
            <PanelLeft className="ml-auto size-4 rotate-180" />
          </SidebarMenuButton>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="min-w-56 rounded-xl"
        side={mobile ? "bottom" : "top"}
        align={mobile ? "end" : "start"}
        sideOffset={8}
      >
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-2 px-2 py-2 text-left text-sm">
            <Avatar className="size-9 rounded-lg">
              <AvatarImage src={user.avatar || undefined} alt={user.name} />
              <AvatarFallback className="rounded-lg">{getInitials(user.name)}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-muted-foreground text-xs">{user.email}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem disabled className="opacity-50">
            <UserRound />
            Mi cuenta
            <span className="ml-auto text-muted-foreground text-xs">No disponible</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onSelect={() => void logoutAction()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function PlatformSidebar({ user, logoutAction }: { user: PlatformUser; logoutAction: () => Promise<void> }) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="ELI Platform Admin" className="h-10">
              <Link prefetch={false} href="/platform">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary font-semibold text-primary-foreground">
                  P
                </span>
                <span className="font-semibold">ELI Platform</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {platformDesktopPrimaryItems.map((item) => (
                <PlatformNavigationButton
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  canAccessOnboarding={user.canAccessOnboarding}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administración</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {platformDesktopAdministrationItems.map((item) => (
                <PlatformNavigationButton
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  canAccessOnboarding={user.canAccessOnboarding}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <PlatformAccountMenu user={user} logoutAction={logoutAction} />
      </SidebarFooter>
    </Sidebar>
  );
}

function PlatformMobileMoreMenu({ canAccessOnboarding }: { canAccessOnboarding: boolean }) {
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
          aria-label={PLATFORM_MOBILE_MORE_LABEL}
        >
          <Ellipsis aria-hidden="true" className="size-5" />
          <span className="truncate">{PLATFORM_MOBILE_MORE_LABEL}</span>
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Más</DrawerTitle>
          <DrawerDescription>Administración de ELI Platform</DrawerDescription>
        </DrawerHeader>
        <div className="space-y-1 px-4 pb-4">
          {platformMobileMoreItems
            .filter((item) => item.id !== "onboarding" || canAccessOnboarding)
            .map((item) => {
              const Icon = item.icon;
              const isAvailable = item.availability === "available" && Boolean(item.href);

              return isAvailable && item.href ? (
                <Button key={item.id} asChild variant="ghost" className="h-12 w-full justify-start gap-3 px-3">
                  <Link prefetch={false} href={item.href} onClick={() => setOpen(false)}>
                    <Icon aria-hidden="true" className="size-5" />
                    <span className="flex-1 text-left">{item.label}</span>
                  </Link>
                </Button>
              ) : (
                <Button
                  key={item.id}
                  disabled
                  variant="ghost"
                  className="h-12 w-full justify-start gap-3 px-3 opacity-70"
                >
                  <Icon aria-hidden="true" className="size-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-muted-foreground text-xs">No disponible</span>
                </Button>
              );
            })}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function PlatformMobileShell({
  children,
  user,
  logoutAction,
}: {
  children: React.ReactNode;
  user: PlatformUser;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-[linear-gradient(180deg,#f7fbff_0%,#f8fafc_52%,#f1f5f9_100%)]">
      <header className="mx-auto flex max-w-md items-center justify-between px-4 pt-5">
        <div>
          <p className="text-muted-foreground text-xs uppercase tracking-[0.18em]">ELI</p>
          <p className="font-semibold text-lg tracking-tight">Platform Admin</p>
        </div>
        <PlatformAccountMenu user={user} logoutAction={logoutAction} mobile />
      </header>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-6 pb-28">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
        aria-label="Platform navigation"
      >
        <div className="mx-auto flex max-w-md items-center justify-between rounded-[1.75rem] border border-border/60 bg-background/92 p-2 shadow-[0_18px_60px_-20px_rgba(15,23,42,0.4)] backdrop-blur-2xl">
          {platformMobilePrimaryItems.map((item) => {
            const Icon = item.icon;
            const isAvailable = item.availability === "available" && Boolean(item.href);
            const isActive = isAvailable && item.href ? isPlatformNavigationActive(pathname, item.href) : false;

            return isAvailable && item.href ? (
              <Link
                key={item.id}
                prefetch={false}
                href={item.href}
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
          })}
          <PlatformMobileMoreMenu canAccessOnboarding={user.canAccessOnboarding} />
        </div>
      </nav>
    </div>
  );
}

export function PlatformShellClient({ children, currentUser, logoutAction }: PlatformShellClientProps) {
  const [mounted, setMounted] = React.useState(false);
  const isMobile = useIsMobile();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-dvh bg-background p-4 md:p-6">{children}</div>;
  }

  if (isMobile) {
    return (
      <PlatformMobileShell user={currentUser} logoutAction={logoutAction}>
        {children}
      </PlatformMobileShell>
    );
  }

  return (
    <SidebarProvider>
      <PlatformSidebar user={currentUser} logoutAction={logoutAction} />
      <SidebarInset className="min-w-0">
        <header className="flex h-14 shrink-0 items-center border-b px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <div>
              <p className="text-muted-foreground text-xs">ELI</p>
              <p className="font-semibold text-sm">Platform Admin</p>
            </div>
          </div>
        </header>
        <div className="min-w-0 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
