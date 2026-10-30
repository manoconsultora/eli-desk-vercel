import type { Carpeta } from "@/lib/comprobantes/comprobante-rules";

// The words each Documentos folder shows. Months go in lowercase ("octubre de 2026"), inside a sentence.
// The folders without month have no month label, and their removeBody gets no month.
export type FolderTexts = {
  title: string;
  description: string;
  uploadHeading: string;
  monthLabel?: string;
  uploaded: (count: number) => string;
  count: { singular: string; plural: string };
  searchLabel: string;
  empty: string;
  listFailed: string;
  noMatch: string;
  removeTitle: string;
  removeBody: (name: string, month: string | null) => string;
};

export const FOLDER_TEXTS: Record<Carpeta, FolderTexts> = {
  liquidaciones: {
    title: "Liquidaciones",
    description: "El PDF de la liquidación de expensas de cada mes.",
    uploadHeading: "Cargar liquidaciones",
    monthLabel: "Liquidación de",
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
    uploaded: (count) => (count === 1 ? "Se cargó 1 comprobante." : `Se cargaron ${count} comprobantes.`),
    count: { singular: "comprobante", plural: "comprobantes" },
    searchLabel: "Buscar comprobante",
    empty: "Este consorcio no tiene comprobantes cargados.",
    listFailed: "No se pudieron mostrar los comprobantes. Probá de nuevo en unos minutos.",
    noMatch: "Ningún comprobante coincide con la búsqueda.",
    removeTitle: "¿Borrar este comprobante?",
    removeBody: (name, month) => `Se borra "${name}" de la liquidación de ${month}. No se puede deshacer.`,
  },
  reglamentos: {
    title: "Reglamentos",
    description: "El reglamento de copropiedad y el reglamento interno del consorcio.",
    uploadHeading: "Cargar reglamentos",
    uploaded: (count) => (count === 1 ? "Se cargó 1 reglamento." : `Se cargaron ${count} reglamentos.`),
    count: { singular: "reglamento", plural: "reglamentos" },
    searchLabel: "Buscar reglamento",
    empty: "Este consorcio no tiene reglamentos cargados.",
    listFailed: "No se pudieron mostrar los reglamentos. Probá de nuevo en unos minutos.",
    noMatch: "Ningún reglamento coincide con la búsqueda.",
    removeTitle: "¿Borrar este reglamento?",
    removeBody: (name) => `Se borra "${name}". No se puede deshacer.`,
  },
  polizas: {
    title: "Pólizas de seguro",
    description: "Las pólizas de los seguros del consorcio.",
    uploadHeading: "Cargar pólizas",
    uploaded: (count) => (count === 1 ? "Se cargó 1 póliza." : `Se cargaron ${count} pólizas.`),
    count: { singular: "póliza", plural: "pólizas" },
    searchLabel: "Buscar póliza",
    empty: "Este consorcio no tiene pólizas cargadas.",
    listFailed: "No se pudieron mostrar las pólizas. Probá de nuevo en unos minutos.",
    noMatch: "Ninguna póliza coincide con la búsqueda.",
    removeTitle: "¿Borrar esta póliza?",
    removeBody: (name) => `Se borra "${name}". No se puede deshacer.`,
  },
  normativas: {
    title: "Normativas",
    description: "Las normas y disposiciones que el consorcio tiene que tener a mano.",
    uploadHeading: "Cargar normativas",
    uploaded: (count) => (count === 1 ? "Se cargó 1 normativa." : `Se cargaron ${count} normativas.`),
    count: { singular: "normativa", plural: "normativas" },
    searchLabel: "Buscar normativa",
    empty: "Este consorcio no tiene normativas cargadas.",
    listFailed: "No se pudieron mostrar las normativas. Probá de nuevo en unos minutos.",
    noMatch: "Ninguna normativa coincide con la búsqueda.",
    removeTitle: "¿Borrar esta normativa?",
    removeBody: (name) => `Se borra "${name}". No se puede deshacer.`,
  },
};
