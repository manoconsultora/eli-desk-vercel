import {
  BarChart3,
  Bell,
  Building2,
  Calculator,
  CalendarDays,
  CircleHelp,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  Scale,
  Settings,
  ShieldCheck,
  Ticket,
  UserPlus,
  Users,
} from "lucide-react";

import type { FeatureId } from "@/features/catalog/feature-catalog";

type DeskModuleAvailability = "available" | "unavailable" | "coming_soon";
type DeskModulePlacement = "mobile_primary" | "mobile_more" | "desktop";
type DeskDesktopSection = "primary" | "future";

export type DeskNavigationItem = {
  id: string;
  featureId?: FeatureId;
  label: string;
  icon: LucideIcon;
  availability: DeskModuleAvailability;
  href?: string;
  placements: readonly DeskModulePlacement[];
  desktopSection: DeskDesktopSection;
};

export const DESK_MOBILE_MORE_LABEL = "Más";

export const deskNavigationItems: readonly DeskNavigationItem[] = [
  {
    id: "inicio",
    label: "Inicio",
    icon: LayoutDashboard,
    availability: "available",
    href: "/dashboard/default",
    placements: ["mobile_primary", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "solicitudes",
    label: "Solicitudes",
    icon: UserPlus,
    availability: "available",
    href: "/dashboard/solicitudes",
    placements: ["mobile_more", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "tickets",
    featureId: "tickets",
    label: "Tickets",
    icon: Ticket,
    availability: "available",
    href: "/dashboard/tickets",
    placements: ["mobile_primary", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "consorcios",
    featureId: "consorcios",
    label: "Consorcios",
    icon: Building2,
    availability: "available",
    href: "/dashboard/consorcios",
    placements: ["mobile_primary", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "residentes",
    featureId: "residentes",
    label: "Residentes",
    icon: Users,
    availability: "available",
    href: "/dashboard/residentes",
    placements: ["mobile_primary", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "documentos",
    featureId: "documentos",
    label: "Documentos",
    icon: FileText,
    availability: "unavailable",
    placements: ["mobile_more", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "notificaciones",
    featureId: "notificaciones",
    label: "Notificaciones",
    icon: Bell,
    availability: "unavailable",
    placements: ["desktop"],
    desktopSection: "primary",
  },
  {
    id: "reservas",
    featureId: "reservas",
    label: "Reservas",
    icon: CalendarDays,
    availability: "unavailable",
    placements: ["desktop"],
    desktopSection: "primary",
  },
  {
    id: "equipo",
    featureId: "equipo",
    label: "Equipo",
    icon: Users,
    href: "/dashboard/equipo",
    availability: "available",
    placements: ["mobile_more", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "seguridad",
    featureId: "seguridad",
    label: "Seguridad",
    icon: ShieldCheck,
    availability: "unavailable",
    placements: ["desktop"],
    desktopSection: "primary",
  },
  {
    id: "configuracion",
    featureId: "tenant_settings",
    label: "Configuración",
    icon: Settings,
    availability: "unavailable",
    placements: ["desktop"],
    desktopSection: "primary",
  },
  {
    id: "soporte",
    featureId: "tenant_support",
    label: "Soporte",
    icon: CircleHelp,
    availability: "unavailable",
    placements: ["mobile_more", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "reporting",
    featureId: "reporting",
    label: "Reporting",
    icon: BarChart3,
    availability: "coming_soon",
    placements: ["desktop"],
    desktopSection: "future",
  },
  {
    id: "contable",
    featureId: "contable",
    label: "Contable",
    icon: Calculator,
    availability: "coming_soon",
    placements: ["desktop"],
    desktopSection: "future",
  },
  {
    id: "legales",
    featureId: "legales",
    label: "Legales",
    icon: Scale,
    availability: "coming_soon",
    placements: ["desktop"],
    desktopSection: "future",
  },
];

export const deskMobilePrimaryItems = deskNavigationItems.filter((item) => item.placements.includes("mobile_primary"));
export const deskMobileMoreItems = deskNavigationItems.filter((item) => item.placements.includes("mobile_more"));
export const deskDesktopNavigationItems = deskNavigationItems.filter((item) => item.placements.includes("desktop"));
