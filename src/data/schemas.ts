export interface Ticket {
  id: string;
  title: string;
  status: "PENDIENTE" | "EN_CURSO" | "FINALIZADO";
  consorcio: string;
  proveedor: string;
  tag: string;
  createdAt: string;
}
