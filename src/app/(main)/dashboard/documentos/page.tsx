import { redirect } from "next/navigation";

// Documentos has one folder so far: its entry opens it.
export default function DocumentosPage() {
  redirect("/dashboard/documentos/comprobantes");
}
