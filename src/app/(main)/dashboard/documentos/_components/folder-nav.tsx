import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CARPETAS, type Carpeta } from "@/lib/comprobantes/comprobante-rules";
import { cn } from "@/lib/utils";

import { FOLDER_TEXTS } from "./folder-texts";

// The folders on the page itself: with the sidebar collapsed its submenu is gone. Keeps the consorcio.
export function FolderNav({ current, communityId }: { current: Carpeta; communityId: string }) {
  return (
    <nav aria-label="Carpetas de Documentos" className="flex w-fit gap-1 rounded-lg bg-muted p-1">
      {CARPETAS.map((carpeta) => {
        const active = carpeta === current;
        return (
          <Button
            key={carpeta}
            asChild
            size="sm"
            variant={active ? "outline" : "ghost"}
            className={cn(!active && "border border-transparent")}
          >
            <Link
              href={`/dashboard/documentos/${carpeta}?consorcio=${encodeURIComponent(communityId)}`}
              aria-current={active ? "page" : undefined}
            >
              {FOLDER_TEXTS[carpeta].title}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
}
