import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "Eli Desk",
  loginName: "Operación de Consorcios",
  version: packageJson.version,
  copyright: `© ${currentYear}, ELI Desk.`,
  meta: {
    title: "Eli Desk - Panel operativo en tiempo real",
    description: "Dashboard de monitoreo en tiempo real para reclamos, urgencias y gestión operativa de consorcios.",
  },
};
