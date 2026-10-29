import { FolderPage } from "../_components/folder-page";

export default function ComprobantesPage({ searchParams }: { searchParams: Promise<{ consorcio?: string }> }) {
  return <FolderPage carpeta="comprobantes" searchParams={searchParams} />;
}
