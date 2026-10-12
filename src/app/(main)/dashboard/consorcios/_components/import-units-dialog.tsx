"use client";

import * as React from "react";

import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRefresh } from "@/hooks/use-refresh";
import { importUnitsAction } from "@/server/communities/community-actions";

import { MAX_IMPORT_ROWS, parseUnitsCsv, UNITS_TEMPLATE } from "./parse-units-csv";

function downloadTemplate() {
  const url = URL.createObjectURL(new Blob([UNITS_TEMPLATE], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla-unidades.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// Upload a CSV or paste cells, review what will be created, then confirm. Existing numbers,
// repeated rows and rows with errors are skipped, never overwritten.
export function ImportUnitsDialog({
  communityId,
  communityName,
  existingNumbers,
}: {
  communityId: string;
  communityName: string;
  existingNumbers: string[];
}) {
  const { refresh, refreshing } = useRefresh();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  // Also busy until the refreshed units are on screen.
  const busy = saving || refreshing;

  const { rows, tooMany } = parseUnitsCsv(text, existingNumbers);
  const toCreate = rows.filter((row) => row.status === "new");
  const skipped = rows.filter((row) => row.status !== "new");

  function changeOpen(next: boolean) {
    if (!next && busy) return;
    setOpen(next);
    if (!next) {
      setText("");
      setError(null);
    }
  }

  async function readFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) setText(await file.text());
  }

  async function create() {
    setSaving(true);
    setError(null);
    const result = await importUnitsAction(
      communityId,
      toCreate.map((row) => ({ number: row.number, floor: row.floor })),
    );
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    const notCreated = rows.length - result.created;
    refresh(() => {
      setOpen(false);
      setText("");
      toast.success(
        `${result.created === 1 ? "Se creó 1 unidad" : `Se crearon ${result.created} unidades`}${
          notCreated > 0 ? `; ${notCreated} se salteó${notCreated === 1 ? "" : "aron"}` : ""
        }.`,
      );
    });
  }

  return (
    <>
      <Button variant="outline" className="h-11 rounded-lg px-4" onClick={() => setOpen(true)}>
        <Upload className="size-4" />
        Importar unidades
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Importar unidades</DialogTitle>
            <DialogDescription>
              Una unidad por línea en {communityName}: número y piso (opcional). Subí un CSV o pegá las celdas de una
              planilla. Las que ya existen se saltean.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <Upload className="size-4" />
                  Subir CSV
                  <input type="file" accept=".csv,.txt,text/csv" className="sr-only" onChange={readFile} />
                </label>
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" />
                Descargar plantilla
              </Button>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="import-units-text">O pegá acá</Label>
              <Textarea
                id="import-units-text"
                rows={6}
                className="font-mono text-sm"
                placeholder={"numero;piso\n1A;1\n1B;1"}
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
              <p className="text-muted-foreground text-xs">
                Probá primero con pocas filas. En Excel, poné la columna de número como Texto para que no cambie números
                como 10E2.
              </p>
            </div>

            {rows.length > 0 && (
              <div className="space-y-2 rounded-lg border p-3 text-sm" aria-live="polite">
                {tooMany ? (
                  <p className="text-destructive">
                    Son {rows.length} filas: se pueden importar hasta {MAX_IMPORT_ROWS} por vez.
                  </p>
                ) : (
                  <p>
                    <span className="font-medium">{toCreate.length} a crear</span>
                    {skipped.length > 0 && (
                      <span className="text-muted-foreground"> · {skipped.length} se saltean</span>
                    )}
                  </p>
                )}
                {skipped.length > 0 && (
                  <ul className="max-h-32 space-y-1 overflow-y-auto text-muted-foreground text-xs">
                    {skipped.map((row) => (
                      <li key={row.line}>
                        Línea {row.line}
                        {row.number && ` (${row.number})`}: {row.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div aria-live="polite">{error && <p className="text-destructive text-sm">{error}</p>}</div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={() => changeOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={busy || tooMany || toCreate.length === 0} onClick={create}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {toCreate.length === 1 ? "Crear 1 unidad" : `Crear ${toCreate.length} unidades`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
