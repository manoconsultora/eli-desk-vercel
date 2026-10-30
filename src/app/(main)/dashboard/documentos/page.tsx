import { redirect } from "next/navigation";

// Documentos opens its first folder.
export default function DocumentosPage() {
  redirect("/dashboard/documentos/liquidaciones");
}
