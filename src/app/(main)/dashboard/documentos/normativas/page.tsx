import { FolderPage } from "../_components/folder-page";

export default function NormativasPage({ searchParams }: { searchParams: Promise<{ consorcio?: string }> }) {
  return <FolderPage carpeta="normativas" searchParams={searchParams} />;
}
