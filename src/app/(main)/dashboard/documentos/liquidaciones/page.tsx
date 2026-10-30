import { FolderPage } from "../_components/folder-page";

export default function LiquidacionesPage({ searchParams }: { searchParams: Promise<{ consorcio?: string }> }) {
  return <FolderPage carpeta="liquidaciones" searchParams={searchParams} />;
}
