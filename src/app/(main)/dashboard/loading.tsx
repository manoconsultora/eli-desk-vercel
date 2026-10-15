import Image from "next/image";

// Replaces only the page content while it loads; the sidebar and header stay mounted.
export default function DashboardLoading() {
  return (
    <output aria-label="Cargando" className="flex flex-1 items-center justify-center">
      <Image src="/logo_eli.svg" alt="" width={112} height={32} className="h-auto w-28 animate-pulse dark:hidden" />
      <Image
        src="/logo_eli_w.svg"
        alt=""
        width={112}
        height={32}
        className="hidden h-auto w-28 animate-pulse dark:block"
      />
    </output>
  );
}
