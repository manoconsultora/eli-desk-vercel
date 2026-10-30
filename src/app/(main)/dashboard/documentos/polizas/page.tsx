import { FolderPage } from "../_components/folder-page";

export default function PolizasPage({ searchParams }: { searchParams: Promise<{ consorcio?: string }> }) {
  return <FolderPage carpeta="polizas" searchParams={searchParams} />;
}
