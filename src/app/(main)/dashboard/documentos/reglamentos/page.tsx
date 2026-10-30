import { FolderPage } from "../_components/folder-page";

export default function ReglamentosPage({ searchParams }: { searchParams: Promise<{ consorcio?: string }> }) {
  return <FolderPage carpeta="reglamentos" searchParams={searchParams} />;
}
