"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { CircleAlert, CircleCheck, Ellipsis, Eye, FileText, ShieldAlert, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  FilterSelect,
  ListActionButton,
  ListCell,
  ListCount,
  ListEmpty,
  ListHead,
  ListSearch,
  ListTable,
  TONE_CLASSES,
} from "@/app/(main)/dashboard/_components/list-table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRefresh } from "@/hooks/use-refresh";
import {
  type Carpeta,
  COMPROBANTE_BUCKET,
  comprobanteFileProblem,
  formatFileSize,
  periodFromMonthInput,
  recentMonthInputs,
} from "@/lib/comprobantes/comprobante-rules";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  confirmComprobanteUploadAction,
  deleteComprobanteAction,
  openComprobanteAction,
  startComprobanteUploadAction,
} from "@/server/comprobantes/comprobante-actions";
import type { ComprobanteSummary } from "@/server/comprobantes/comprobante-repository";

import { filterComprobantes, groupByPeriod } from "./filter-comprobantes";
import { FOLDER_TEXTS } from "./folder-texts";

const monthFormat = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" });
const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium" });

// Months offered to load into: this one and the 23 before it.
const MONTH_OPTIONS = 24;

const UPLOAD_FAILED = "No se pudo cargar el archivo. Probá de nuevo.";

export type ComprobantesFolderData = { comprobantes: ComprobanteSummary[] | null; canManage: boolean };

type UploadItem = {
  id: string;
  name: string;
  size: number;
  // invalid: rejected before loading; failed: the load itself failed.
  status: "queued" | "uploading" | "done" | "failed" | "invalid";
  error?: string;
};

const STATUS_TEXT: Record<"queued" | "uploading" | "done", string> = {
  queued: "Pendiente",
  uploading: "Cargando…",
  done: "Cargado",
};

// "2026-10-01" or "2026-10" is read as a local date, so the month never shifts by time zone.
// "octubre de 2026": lowercase, as it goes inside a sentence.
function monthName(period: string): string {
  const [year, month] = period.split("-").map(Number);
  return monthFormat.format(new Date(year, month - 1, 1));
}

// "Octubre de 2026", for the group headings.
function monthHeading(period: string): string {
  const name = monthName(period);
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// Register it, upload it to the signed path, then confirm it. Never throws: a failure comes back as its message.
async function uploadOne(
  target: { communityId: string; carpeta: Carpeta; month: string },
  file: File,
): Promise<string | null> {
  try {
    const started = await startComprobanteUploadAction({ ...target, fileName: file.name, size: file.size });
    if (!started.success) return started.error;

    const { error } = await createClient()
      .storage.from(COMPROBANTE_BUCKET)
      .uploadToSignedUrl(started.data.path, started.data.token, file);
    if (error) {
      // Drops the row that never got its file, so it doesn't stay pending.
      await deleteComprobanteAction(started.data.id);
      return UPLOAD_FAILED;
    }

    // The file is already in the bucket: one retry before giving up on a network hiccup.
    const confirmed = await confirmComprobanteUploadAction(started.data.id);
    if (confirmed.success) return null;
    const retried = await confirmComprobanteUploadAction(started.data.id);
    return retried.success ? null : retried.error;
  } catch {
    return UPLOAD_FAILED;
  }
}

function UploadTile({ status }: { status: UploadItem["status"] }) {
  if (status === "uploading") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Spinner aria-hidden="true" className="size-5" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TONE_CLASSES.green)}>
        <CircleCheck className="size-5" aria-hidden="true" />
      </span>
    );
  }
  if (status === "queued") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <FileText className="size-5" aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
      <CircleAlert className="size-5" aria-hidden="true" />
    </span>
  );
}

// The batch, as cards inside the zone. Storage doesn't report how much of each file went up,
// so the bar counts files, not bytes.
function UploadQueue({ items }: { items: UploadItem[] }) {
  if (items.length === 0) return null;
  const total = items.filter((item) => item.status !== "invalid").length;
  const finished = items.filter((item) => item.status === "done" || item.status === "failed").length;
  const active = items.some((item) => item.status === "queued" || item.status === "uploading");
  const progress = `Cargando ${Math.min(finished + 1, total)} de ${total}`;
  const failed = items.filter((item) => item.status === "failed" || item.status === "invalid").length;
  const summary = failed === 0 ? "" : failed === 1 ? "1 archivo no se cargó." : `${failed} archivos no se cargaron.`;

  return (
    <div className="space-y-2">
      <output className="sr-only">{active ? progress : summary}</output>
      {active && (
        <div className="space-y-1.5 px-1">
          <p className="text-muted-foreground text-xs">{progress}</p>
          <Progress value={(finished / total) * 100} aria-label={progress} />
        </div>
      )}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-xs">
            <UploadTile status={item.status} />
            <div className="min-w-0 flex-1">
              <p className="break-all font-medium text-sm">{item.name}</p>
              {item.status === "failed" || item.status === "invalid" ? (
                <p className="text-destructive text-xs">{item.error ?? UPLOAD_FAILED}</p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  {formatFileSize(item.size)} · {STATUS_TEXT[item.status]}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComprobantesFolder({
  carpeta,
  communities,
  communityId,
  data,
}: {
  carpeta: Carpeta;
  communities: { id: string; name: string }[];
  communityId: string;
  data: ComprobantesFolderData;
}) {
  const texts = FOLDER_TEXTS[carpeta];
  const router = useRouter();
  const { refresh, refreshing } = useRefresh();
  const [navigating, startNavigation] = React.useTransition();
  // Set after mount: the page is rendered on the server too, whose clock and time zone may say another month.
  const [months, setMonths] = React.useState<string[]>([]);
  const [month, setMonth] = React.useState("");
  React.useEffect(() => {
    const options = recentMonthInputs(new Date(), MONTH_OPTIONS);
    setMonths(options);
    setMonth(options[0]);
  }, []);
  const [uploading, setUploading] = React.useState(false);
  const [items, setItems] = React.useState<UploadItem[]>([]);
  const [dragging, setDragging] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [removing, setRemoving] = React.useState<ComprobanteSummary | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  const busy = uploading || saving || refreshing || navigating;

  // A PDF dropped next to the zone would make the browser open it and leave the page.
  React.useEffect(() => {
    if (!data.canManage) return;
    function keepPage(event: DragEvent) {
      event.preventDefault();
    }
    window.addEventListener("dragover", keepPage);
    window.addEventListener("drop", keepPage);
    return () => {
      window.removeEventListener("dragover", keepPage);
      window.removeEventListener("drop", keepPage);
    };
  }, [data.canManage]);

  function updateItem(id: string, change: Partial<UploadItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...change } : item)));
  }

  async function handleFiles(files: File[]) {
    if (files.length === 0 || busy || !periodFromMonthInput(month)) return;
    const queue = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      problem: file.type === "application/pdf" ? comprobanteFileProblem(file) : "Solo se aceptan PDF.",
    }));
    setItems(
      queue.map(({ id, file, problem }) =>
        problem
          ? { id, name: file.name, size: file.size, status: "invalid", error: problem }
          : { id, name: file.name, size: file.size, status: "queued" },
      ),
    );
    if (queue.every((item) => item.problem)) return;

    setUploading(true);
    let uploaded = 0;
    // In order and one by one: uploadOne never throws, so a failure stays on its file and the rest still load.
    for (const item of queue) {
      if (item.problem) continue;
      updateItem(item.id, { status: "uploading" });
      const failure = await uploadOne({ communityId, carpeta, month }, item.file);
      updateItem(item.id, failure ? { status: "failed", error: failure } : { status: "done" });
      if (!failure) uploaded += 1;
    }
    refresh(() => {
      setUploading(false);
      if (uploaded > 0) toast.success(texts.uploaded(uploaded));
    });
  }

  function changeCommunity(id: string) {
    startNavigation(() => router.replace(`/dashboard/documentos/${carpeta}?consorcio=${encodeURIComponent(id)}`));
  }

  async function openFile(comprobante: ComprobanteSummary) {
    setError(null);
    // Opened before the await so the browser doesn't block it as a popup.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await openComprobanteAction(comprobante.id);
      if (!result.success) throw new Error(result.error);
      if (tab) tab.location.href = result.data;
      else window.location.assign(result.data);
    } catch (cause) {
      tab?.close();
      setError(
        cause instanceof Error && cause.message ? cause.message : "No se pudo abrir el archivo. Probá de nuevo.",
      );
    }
  }

  async function confirmRemove(comprobante: ComprobanteSummary) {
    setSaving(true);
    setError(null);
    const result = await deleteComprobanteAction(comprobante.id);
    setSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    // It is gone from the list either way; a file left in the bucket is said out loud.
    if (result.data.fileKept) toast.error("Se borró de la lista, pero el archivo sigue guardado. Avisá a soporte.");
    refresh(() => setRemoving(null));
  }

  const comprobantes = data.comprobantes ?? [];
  const groups = groupByPeriod(filterComprobantes(comprobantes, search));
  const columns = data.canManage ? 5 : 4;

  return (
    <div className="space-y-6">
      <div className="flex">
        <FilterSelect
          label="Consorcio"
          value={communityId}
          disabled={busy}
          onChange={(event) => changeCommunity(event.target.value)}
        >
          {communities.map((community) => (
            <option key={community.id} value={community.id}>
              Consorcio: {community.name}
            </option>
          ))}
        </FilterSelect>
      </div>

      {data.canManage && (
        <section
          aria-label={texts.uploadHeading}
          className={cn("space-y-2 rounded-xl border bg-muted/50 p-2", dragging && "border-primary bg-primary/5")}
          onDragOver={(event) => {
            event.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            handleFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="flex flex-col gap-2 px-2 pt-2 md:flex-row md:items-center md:justify-between">
            <h3 className="font-medium text-sm">{texts.uploadHeading}</h3>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <label htmlFor="comprobantes-mes" className="text-muted-foreground text-sm">
                {texts.monthLabel}
              </label>
              <FilterSelect
                id="comprobantes-mes"
                label={texts.monthLabel}
                value={month}
                disabled={busy || months.length === 0}
                onChange={(event) => setMonth(event.target.value)}
              >
                {months.map((option) => (
                  <option key={option} value={option}>
                    {monthName(option)}
                  </option>
                ))}
              </FilterSelect>
            </div>
          </div>
          <div className="mx-2 flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            <div className="space-y-1">
              <p id="documentos-aviso" className="font-medium">
                {texts.notice.title}
              </p>
              <p className="text-muted-foreground">{texts.notice.body}</p>
            </div>
          </div>
          {/* The whole area is the control: it opens the picker. Dropping anywhere on the zone also works. */}
          <button
            type="button"
            aria-describedby="documentos-aviso"
            disabled={busy || !month}
            onClick={() => fileInput.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-lg px-6 py-8 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-background shadow-xs">
              <Upload className="size-5 text-muted-foreground" aria-hidden="true" />
            </span>
            <span className="text-muted-foreground text-sm">
              {/* Touch screens can't drag, so the base text doesn't promise it. */}
              <span className="hidden pointer-fine:inline">
                {dragging ? "Soltá los PDF para cargarlos" : "Hacé clic o arrastrá los PDF"}
              </span>
              <span className="pointer-fine:hidden">Tocá para elegir los PDF</span>
            </span>
            <span className="text-muted-foreground text-sm">Solo PDF, hasta 10 MB cada uno.</span>
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf"
            multiple
            tabIndex={-1}
            disabled={busy}
            className="sr-only"
            aria-label="Elegir archivos PDF"
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              // Reset now, so picking the same files again after an error fires another change.
              event.target.value = "";
              handleFiles(files);
            }}
          />
          <UploadQueue items={items} />
        </section>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <ListSearch
          aria-label={texts.searchLabel}
          placeholder="Buscar por nombre del archivo…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ListCount count={comprobantes.length} singular={texts.count.singular} plural={texts.count.plural} />
      </div>

      <div aria-live="polite">{error && !removing && <p className="text-destructive text-sm">{error}</p>}</div>

      {data.comprobantes === null ? (
        <ListEmpty>{texts.listFailed}</ListEmpty>
      ) : comprobantes.length === 0 ? (
        <ListEmpty>{texts.empty}</ListEmpty>
      ) : groups.length === 0 ? (
        <ListEmpty>{texts.noMatch}</ListEmpty>
      ) : (
        <ListTable>
          <TableHeader>
            <TableRow>
              <ListHead>Archivo</ListHead>
              <ListHead desktopOnly>Tamaño</ListHead>
              <ListHead desktopOnly>Fecha de carga</ListHead>
              <ListHead desktopOnly>Cargado por</ListHead>
              {data.canManage && (
                <ListHead>
                  <span className="sr-only">Acciones</span>
                </ListHead>
              )}
            </TableRow>
          </TableHeader>
          {groups.map(([period, group]) => (
            <TableBody key={period}>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead colSpan={columns} scope="colgroup" className="h-10 px-4 font-semibold text-foreground">
                  {monthHeading(period)}
                </TableHead>
              </TableRow>
              {group.map((comprobante) => (
                <TableRow key={comprobante.id}>
                  <ListCell wrap>
                    <button
                      type="button"
                      className="flex items-center gap-3 text-left font-medium underline-offset-4 hover:underline"
                      onClick={() => openFile(comprobante)}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileText className="size-4" aria-hidden="true" />
                      </span>
                      <span className="break-all">{comprobante.name}</span>
                    </button>
                    <p className="mt-1 text-muted-foreground text-xs md:hidden">
                      {formatFileSize(comprobante.sizeBytes)} · {dateFormat.format(new Date(comprobante.uploadedAt))}
                    </p>
                  </ListCell>
                  <ListCell muted desktopOnly>
                    {formatFileSize(comprobante.sizeBytes)}
                  </ListCell>
                  <ListCell muted desktopOnly>
                    {dateFormat.format(new Date(comprobante.uploadedAt))}
                  </ListCell>
                  <ListCell muted desktopOnly>
                    {comprobante.uploadedBy}
                  </ListCell>
                  {data.canManage && (
                    <ListCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <ListActionButton
                            size="icon"
                            aria-label={`Acciones para ${comprobante.name}`}
                            disabled={busy}
                          >
                            <Ellipsis aria-hidden="true" />
                          </ListActionButton>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => openFile(comprobante)}>
                            <Eye />
                            Ver
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => {
                              setError(null);
                              setRemoving(comprobante);
                            }}
                          >
                            <Trash2 />
                            Borrar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ListCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          ))}
        </ListTable>
      )}

      <AlertDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next && !busy) {
            setRemoving(null);
            setError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{texts.removeTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {removing && texts.removeBody(removing.name, monthName(removing.period))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div aria-live="polite">{error && <p className="text-destructive text-sm">{error}</p>}</div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={busy} onClick={() => removing && confirmRemove(removing)}>
              Borrar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
