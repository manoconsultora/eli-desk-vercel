// Roles the owner can give from Equipo; TENANT_OWNER is never invited or changed there.
export const TEAM_ROLES = ["ADMIN", "OPERATOR", "VIEWER"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

const LABELS: Record<string, string> = {
  TENANT_OWNER: "Dueño",
  ADMIN: "Administrador",
  OPERATOR: "Operador",
  VIEWER: "Solo lectura",
};

export const TEAM_ROLE_DESCRIPTIONS: Record<TeamRole, string> = {
  ADMIN: "Revisa solicitudes, gestiona residentes y unidades, y puede borrar unidades y sacar de la blacklist.",
  OPERATOR: "Revisa solicitudes y gestiona residentes y unidades.",
  VIEWER: "Solo consulta sus consorcios: no puede cambiar nada.",
};

export const teamRoleLabel = (role: string) => LABELS[role] ?? role;
