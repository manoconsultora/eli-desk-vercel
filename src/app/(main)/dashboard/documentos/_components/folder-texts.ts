import type { Carpeta } from "@/lib/comprobantes/comprobante-rules";

// The words each Documentos folder shows. Months go in lowercase ("octubre de 2026"), inside a sentence.
export type FolderTexts = {
  title: string;
  description: string;
  uploadHeading: string;
  monthLabel: string;
  notice: { title: string; body: string };
  uploaded: (count: number) => string;
  count: { singular: string; plural: string };
  searchLabel: string;
  empty: string;
  listFailed: string;
  noMatch: string;
  removeTitle: string;
  removeBody: (name: string, month: string) => string;
};

export const FOLDER_TEXTS: Record<Carpeta, FolderTexts> = {
  liquidaciones: {
    title: "Liquidaciones",
    description: "El PDF de la liquidación de expensas de cada mes, tal como sale de tu sistema.",
    uploadHeading: "Cargar liquidaciones",
    monthLabel: "Liquidación de",
    notice: {
      title: "Antes de cargar la liquidación",
      body: "Si detalla la cuota sindical del encargado, tapala. Usá una herramienta que borre el texto: un rectángulo dibujado encima lo deja debajo y se puede copiar.",
    },
    uploaded: (count) => (count === 1 ? "Se cargó 1 liquidación." : `Se cargaron ${count} liquidaciones.`),
    count: { singular: "liquidación", plural: "liquidaciones" },
    searchLabel: "Buscar liquidación",
    empty: "Este consorcio no tiene liquidaciones cargadas.",
    listFailed: "No se pudieron mostrar las liquidaciones. Probá de nuevo en unos minutos.",
    noMatch: "Ninguna liquidación coincide con la búsqueda.",
    removeTitle: "¿Borrar esta liquidación?",
    removeBody: (name, month) => `Se borra "${name}", la liquidación de ${month}. No se puede deshacer.`,
  },
  comprobantes: {
    title: "Comprobantes",
    description: "Los PDF de los gastos de cada liquidación, agrupados por mes.",
    uploadHeading: "Cargar comprobantes",
    monthLabel: "Se cargan en la liquidación de",
    notice: {
      title: "Antes de cargar recibos de sueldo o boletas sindicales",
      body: "Tapá la cuota sindical y los datos de salud. En papel, hacelo antes de escanear. En el PDF, usá una herramienta que borre el texto: un rectángulo dibujado encima lo deja debajo y se puede copiar.",
    },
    uploaded: (count) => (count === 1 ? "Se cargó 1 comprobante." : `Se cargaron ${count} comprobantes.`),
    count: { singular: "comprobante", plural: "comprobantes" },
    searchLabel: "Buscar comprobante",
    empty: "Este consorcio no tiene comprobantes cargados.",
    listFailed: "No se pudieron mostrar los comprobantes. Probá de nuevo en unos minutos.",
    noMatch: "Ningún comprobante coincide con la búsqueda.",
    removeTitle: "¿Borrar este comprobante?",
    removeBody: (name, month) => `Se borra "${name}" de la liquidación de ${month}. No se puede deshacer.`,
  },
};
