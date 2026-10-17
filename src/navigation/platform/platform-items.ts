import { Building2, Headset, LayoutDashboard, type LucideIcon, Rocket, Settings, Users } from "lucide-react";

import type { FeatureId } from "@/features/catalog/feature-catalog";

type PlatformItemAvailability = "available" | "unavailable";
type PlatformItemPlacement = "mobile_primary" | "mobile_more" | "desktop";
type PlatformDesktopSection = "primary" | "administration";

export type PlatformNavigationItem = {
  id: string;
  featureId?: FeatureId;
  label: string;
  icon: LucideIcon;
  availability: PlatformItemAvailability;
  href?: string;
  placements: readonly PlatformItemPlacement[];
  desktopSection: PlatformDesktopSection;
};

export const PLATFORM_MOBILE_MORE_LABEL = "Más";

const platformNavigationItems: readonly PlatformNavigationItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    availability: "available",
    href: "/platform",
    placements: ["mobile_primary", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "organizations",
    featureId: "organizations",
    label: "Organizations",
    icon: Building2,
    availability: "unavailable",
    placements: ["mobile_primary", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "users",
    featureId: "users",
    label: "Users",
    icon: Users,
    availability: "unavailable",
    placements: ["mobile_primary", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "support",
    featureId: "platform_support",
    label: "Support",
    icon: Headset,
    availability: "unavailable",
    placements: ["mobile_primary", "desktop"],
    desktopSection: "primary",
  },
  {
    id: "onboarding",
    featureId: "onboarding",
    label: "Onboarding",
    icon: Rocket,
    availability: "available",
    href: "/platform/onboarding",
    placements: ["mobile_more", "desktop"],
    desktopSection: "administration",
  },
  {
    id: "planes",
    featureId: "planes",
    label: "Planes",
    icon: Settings,
    availability: "unavailable",
    placements: ["mobile_more", "desktop"],
    desktopSection: "administration",
  },
  {
    id: "suscripciones",
    featureId: "suscripciones",
    label: "Suscripciones",
    icon: Settings,
    availability: "unavailable",
    placements: ["mobile_more", "desktop"],
    desktopSection: "administration",
  },
  {
    id: "sistema",
    featureId: "platform_system",
    label: "Sistema",
    icon: Settings,
    availability: "unavailable",
    placements: ["mobile_more", "desktop"],
    desktopSection: "administration",
  },
];

export const platformMobilePrimaryItems = platformNavigationItems.filter((item) =>
  item.placements.includes("mobile_primary"),
);
export const platformMobileMoreItems = platformNavigationItems.filter((item) =>
  item.placements.includes("mobile_more"),
);
export const platformDesktopPrimaryItems = platformNavigationItems.filter(
  (item) => item.desktopSection === "primary" && item.placements.includes("desktop"),
);
export const platformDesktopAdministrationItems = platformNavigationItems.filter(
  (item) => item.desktopSection === "administration" && item.placements.includes("desktop"),
);
