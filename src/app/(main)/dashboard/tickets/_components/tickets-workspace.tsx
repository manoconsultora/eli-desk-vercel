"use client";

import * as React from "react";

import { Download, Loader2, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { subscribeTicketRslEvent } from "@/lib/realtime/ticket-rsl-events";
import {
  changeTicketStatus,
  closeTicket,
  createTicket,
  getTicketById,
  listTicketEdificios,
  listTickets,
  updateTicket,
} from "@/server/tickets/ticket-actions";
import {
  TICKET_PRIORITIES,
  TICKET_TYPES,
  type TicketPriority,
  type TicketRecord,
  type TicketType,
} from "@/server/tickets/ticket-repository";

const STATUS_LABELS = { abierto: "Abierto", en_proceso: "En proceso", cerrado: "Cerrado" } as const;
const TYPE_LABELS = { reclamo: "Reclamo", urgencia: "Urgencia", consulta: "Consulta", pago: "Pago" } as const;

type FormState = {
  edificio_id: string;
  ticket_type: TicketType;
  priority: TicketPriority;
  category: string;
  description: string;
};

const EMPTY_FORM: FormState = {
  edificio_id: "",
  ticket_type: "reclamo",
  priority: "normal",
  category: "",
  description: "",
};

function statusClass(status: string) {
  if (status === "cerrado") return "border-slate-300 text-slate-600";
  if (status === "en_proceso") return "border-blue-300 text-blue-700";
  return "border-emerald-300 text-emerald-700";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function csvValue(value: string | null | undefined) {
  const text = String(value ?? "");
  const safeText = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}

export function TicketsWorkspace({ initialEdificioFilter }: { initialEdificioFilter?: string }) {
  const [tickets, setTickets] = React.useState<TicketRecord[]>([]);
  const [edificios, setEdificios] = React.useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("todos");
  const [priorityFilter, setPriorityFilter] = React.useState("todas");
  const [edificioFilter, setEdificioFilter] = React.useState(initialEdificioFilter ?? "todos");
  const [selected, setSelected] = React.useState<TicketRecord | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<TicketRecord | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [closeReason, setCloseReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [realtimeUpdatedAt, setRealtimeUpdatedAt] = React.useState<Record<string, string>>({});
  const [realtimeHighlightAt, setRealtimeHighlightAt] = React.useState<Record<string, number>>({});
  const [realtimeNewAt, setRealtimeNewAt] = React.useState<Record<string, number>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [ticketResult, edificioResult] = await Promise.all([listTickets(), listTicketEdificios()]);
    if (!ticketResult.success) setError(ticketResult.error);
    else setTickets(ticketResult.data);
    if (edificioResult.success) {
      setEdificios(edificioResult.data);
      // A consorcio from the URL that is unknown or not assigned falls back to all.
      setEdificioFilter((current) =>
        current === "todos" || edificioResult.data.some((edificio) => edificio.id === current) ? current : "todos",
      );
    } else if (!ticketResult.success) setError(edificioResult.error);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    return subscribeTicketRslEvent((event) => {
      void (async () => {
        const result = await getTicketById(event.ticketId);

        if (!result.success) {
          console.error("[RSL] Could not hydrate ticket", {
            ticketId: event.ticketId,
            eventType: event.type,
            error: result.error,
          });
          return;
        }

        const ticket = result.data;

        if (!ticket) {
          setTickets((current) => current.filter((currentTicket) => currentTicket.id !== event.ticketId));
          return;
        }

        const timestamp = new Intl.DateTimeFormat("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date());

        setRealtimeUpdatedAt((current) => ({
          ...current,
          [ticket.id]: timestamp,
        }));

        const highlightMarker = Date.now();

        setRealtimeHighlightAt((current) => ({
          ...current,
          [ticket.id]: highlightMarker,
        }));

        window.setTimeout(() => {
          setRealtimeHighlightAt((current) => {
            if (current[ticket.id] !== highlightMarker) return current;

            const next = { ...current };
            delete next[ticket.id];
            return next;
          });
        }, 8000);

        if (event.type === "ticket.created") {
          const newMarker = Date.now();

          setRealtimeNewAt((current) => ({
            ...current,
            [ticket.id]: newMarker,
          }));

          window.setTimeout(() => {
            setRealtimeNewAt((current) => {
              if (current[ticket.id] !== newMarker) return current;

              const next = { ...current };
              delete next[ticket.id];
              return next;
            });
          }, 30000);
        }

        setTickets((current) => [ticket, ...current.filter((currentTicket) => currentTicket.id !== ticket.id)]);

        setSelected((current) => (current?.id === ticket.id ? ticket : current));

        console.info("[RSL] Ticket patched", {
          ticketId: ticket.id,
          eventType: event.type,
          updatedAt: timestamp,
        });
      })();
    });
  }, []);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      const matchesTerm =
        !term ||
        [ticket.ticket_code, ticket.description, ticket.edificio_nombre].some((value) =>
          value?.toLowerCase().includes(term),
        );
      const matchesStatus = statusFilter === "todos" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "todas" || ticket.priority === priorityFilter;
      const matchesEdificio = edificioFilter === "todos" || ticket.edificio_id === edificioFilter;
      return matchesTerm && matchesStatus && matchesPriority && matchesEdificio;
    });
  }, [tickets, search, statusFilter, priorityFilter, edificioFilter]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, edificio_id: edificios[0]?.id ?? "" });
    setActionError(null);
    setFormOpen(true);
  }

  function openEdit(ticket: TicketRecord) {
    setEditing(ticket);
    setForm({
      edificio_id: ticket.edificio_id,
      ticket_type: (TICKET_TYPES.includes(ticket.ticket_type as TicketType)
        ? ticket.ticket_type
        : "reclamo") as TicketType,
      priority: (TICKET_PRIORITIES.includes(ticket.priority as TicketPriority)
        ? ticket.priority
        : "normal") as TicketPriority,
      category: ticket.category ?? "",
      description: ticket.description ?? "",
    });
    setActionError(null);
    setFormOpen(true);
  }

  function openClose() {
    if (!selected || selected.status === "cerrado" || saving) return;
    setActionError(null);
    setCloseReason("");
    setCloseOpen(true);
  }

  async function saveForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setActionError(null);
    const input = { ...form, category: form.category.trim() || null, description: form.description.trim() };
    const result = editing ? await updateTicket(editing.id, input) : await createTicket(input);
    if (!result.success) {
      setActionError(result.error);
      setSaving(false);
      return;
    }
    setFormOpen(false);
    setSaving(false);
    await load();
    setSelected(result.data);
  }

  async function setStatus(status: "abierto" | "en_proceso") {
    if (!selected) return;
    setSaving(true);
    setActionError(null);
    const result = await changeTicketStatus(selected.id, status);
    if (!result.success) setActionError(result.error);
    else {
      setSelected(result.data);
      await load();
    }
    setSaving(false);
  }

  async function confirmClose(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || selected.status === "cerrado" || saving) return;
    const reason = closeReason.trim();
    if (!reason) {
      setActionError("El motivo de cierre es obligatorio.");
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const result = await closeTicket(selected.id, reason);
      if (!result.success) {
        setActionError(result.error);
        return;
      }
      if (result.data.status !== "cerrado") {
        setActionError("No se pudo confirmar el cierre del ticket.");
        return;
      }

      setTickets((current) => current.map((ticket) => (ticket.id === result.data.id ? result.data : ticket)));
      setSelected(result.data);
      setCloseOpen(false);
      setCloseReason("");
    } catch {
      setActionError("No se pudo cerrar el ticket.");
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const header = ["Código", "Consorcio", "Tipo", "Prioridad", "Estado", "Descripción", "Creado"];
    const rows = filtered.map((ticket) => [
      ticket.ticket_code,
      ticket.edificio_nombre,
      TYPE_LABELS[ticket.ticket_type as TicketType] ?? ticket.ticket_type,
      ticket.priority,
      STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] ?? ticket.status,
      ticket.description,
      formatDate(ticket.created_at),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `eli-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes eli-ticket-arrival {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.995);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes eli-ticket-spark {
          0% {
            opacity: 0;
            transform: translate(0, 2px) scale(0.4);
          }
          35% {
            opacity: 0.9;
          }
          100% {
            opacity: 0;
            transform: translate(var(--spark-x), var(--spark-y)) scale(1.15);
          }
        }

        .eli-ticket-arrival {
          animation: eli-ticket-arrival 380ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .eli-ticket-spark {
          animation: eli-ticket-spark 850ms ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          .eli-ticket-arrival,
          .eli-ticket-spark {
            animation: none !important;
          }
        }
      `}</style>
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="font-medium text-muted-foreground text-sm">Operación diaria</p>
          <h1 className="font-semibold text-3xl tracking-tight">Tickets</h1>
          <p className="mt-1 text-muted-foreground">Lista autorizada de incidencias y solicitudes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
            <Download className="mr-2 size-4" />
            Exportar CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="mr-2 size-4" />
            Nuevo ticket
          </Button>
        </div>
      </header>

      <Card>
        <CardHeader className="gap-4">
          <CardTitle className="text-lg">Bandeja de tickets</CardTitle>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_repeat(3,160px)]">
            <div className="relative">
              <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar código, descripción o consorcio"
                className="pl-9"
              />
            </div>
            <select
              aria-label="Filtrar por estado"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="todos">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por prioridad"
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="todas">Todas las prioridades</option>
              {TICKET_PRIORITIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
            <select
              aria-label="Filtrar por consorcio"
              value={edificioFilter}
              onChange={(event) => setEdificioFilter(event.target.value)}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="todos">Todos los consorcios</option>
              {edificios.map((edificio) => (
                <option key={edificio.id} value={edificio.id}>
                  {edificio.nombre}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="h-16 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : error ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 p-4 text-destructive text-sm">
              <span>{error}</span>
              <Button variant="outline" onClick={() => void load()}>
                Reintentar
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground text-sm">
              No hay tickets que coincidan con los filtros.
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((ticket) => {
                const realtimeUpdated = realtimeUpdatedAt[ticket.id];
                const isRealtimeHighlighted = Boolean(realtimeHighlightAt[ticket.id]);
                const isRealtimeNew = Boolean(realtimeNewAt[ticket.id]);

                return (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => setSelected(ticket)}
                    className={`relative grid w-full gap-3 overflow-hidden rounded-lg border p-4 text-left transition-[background-color,border-color,box-shadow,transform] duration-300 hover:bg-muted/50 md:grid-cols-[minmax(0,1fr)_180px_110px_110px] md:items-center ${
                      isRealtimeHighlighted
                        ? "eli-ticket-arrival border-sky-200 bg-sky-50/80 shadow-sm ring-1 ring-sky-200/60 dark:bg-sky-950/20"
                        : ""
                    }`}
                  >
                    {isRealtimeNew ? (
                      <span aria-hidden="true" className="pointer-events-none absolute top-2 right-3 h-7 w-12">
                        <span
                          className="eli-ticket-spark absolute top-3 right-5 size-1 rounded-full bg-sky-400"
                          style={
                            {
                              "--spark-x": "12px",
                              "--spark-y": "-10px",
                            } as React.CSSProperties
                          }
                        />
                        <span
                          className="eli-ticket-spark absolute top-2 right-6 size-1 rounded-full bg-sky-300"
                          style={
                            {
                              "--spark-x": "-10px",
                              "--spark-y": "-9px",
                              animationDelay: "90ms",
                            } as React.CSSProperties
                          }
                        />
                        <span
                          className="eli-ticket-spark absolute top-4 right-4 size-1.5 rounded-full bg-sky-400"
                          style={
                            {
                              "--spark-x": "13px",
                              "--spark-y": "7px",
                              animationDelay: "160ms",
                            } as React.CSSProperties
                          }
                        />
                        <span
                          className="eli-ticket-spark absolute top-4 right-7 size-1 rounded-full bg-sky-300"
                          style={
                            {
                              "--spark-x": "-12px",
                              "--spark-y": "8px",
                              animationDelay: "230ms",
                            } as React.CSSProperties
                          }
                        />
                      </span>
                    ) : null}

                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate font-semibold">{ticket.ticket_code}</p>

                        {isRealtimeNew ? <Badge className="h-5 px-1.5 text-[10px] tracking-wide">NUEVO</Badge> : null}

                        {realtimeUpdated ? (
                          <Badge
                            variant="outline"
                            className="h-5 border-sky-200 bg-sky-50 px-1.5 text-[10px] text-sky-700 dark:bg-sky-950/30 dark:text-sky-300"
                          >
                            UPDATED {realtimeUpdated}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="truncate text-muted-foreground text-sm">
                        {ticket.description || "Sin descripción"}
                      </p>

                      <p className="mt-1 text-muted-foreground text-xs">{ticket.edificio_nombre || "Sin consorcio"}</p>
                    </div>

                    <span className="text-muted-foreground text-sm">
                      {TYPE_LABELS[ticket.ticket_type as TicketType] ?? ticket.ticket_type}
                    </span>

                    <span className="text-sm capitalize">{ticket.priority}</span>

                    <Badge variant="outline" className={`w-fit ${statusClass(ticket.status)}`}>
                      {STATUS_LABELS[ticket.status as keyof typeof STATUS_LABELS] ?? ticket.status}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>{selected.ticket_code}</SheetTitle>
                <SheetDescription>
                  {selected.edificio_nombre || "Sin consorcio"} · creado {formatDate(selected.created_at)}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-6 p-6">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={statusClass(selected.status)}>
                    {STATUS_LABELS[selected.status as keyof typeof STATUS_LABELS] ?? selected.status}
                  </Badge>
                  <Badge variant="secondary">
                    {TYPE_LABELS[selected.ticket_type as TicketType] ?? selected.ticket_type}
                  </Badge>
                  <Badge variant="secondary">{selected.priority}</Badge>
                </div>
                <div>
                  <p className="font-medium text-sm">Descripción</p>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground text-sm">
                    {selected.description || "Sin descripción"}
                  </p>
                </div>
                {selected.category && (
                  <div>
                    <p className="font-medium text-sm">Categoría</p>
                    <p className="mt-1 text-muted-foreground text-sm">{selected.category}</p>
                  </div>
                )}
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button variant="outline" onClick={() => openEdit(selected)}>
                    Editar
                  </Button>
                  {selected.status !== "cerrado" && (
                    <Button variant="outline" onClick={openClose} disabled={saving}>
                      Cerrar ticket
                    </Button>
                  )}
                </div>
                {selected.status !== "cerrado" && (
                  <div className="space-y-2">
                    <p className="font-medium text-sm">Cambiar estado</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selected.status === "abierto" || saving}
                        onClick={() => void setStatus("abierto")}
                      >
                        Abierto
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={selected.status === "en_proceso" || saving}
                        onClick={() => void setStatus("en_proceso")}
                      >
                        En proceso
                      </Button>
                    </div>
                  </div>
                )}
                {actionError && <p className="text-destructive text-sm">{actionError}</p>}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar ticket" : "Nuevo ticket"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Actualiza los campos operativos permitidos."
                : "Crea una incidencia dentro de tu organización autorizada."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveForm} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ticket-edificio">Consorcio</Label>
              <select
                id="ticket-edificio"
                required
                value={form.edificio_id}
                onChange={(event) => setForm((current) => ({ ...current, edificio_id: event.target.value }))}
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                <option value="">Seleccionar consorcio</option>
                {edificios.map((edificio) => (
                  <option key={edificio.id} value={edificio.id}>
                    {edificio.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ticket-type">Tipo</Label>
                <select
                  id="ticket-type"
                  value={form.ticket_type}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, ticket_type: event.target.value as TicketType }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {TICKET_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {TYPE_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ticket-priority">Prioridad</Label>
                <select
                  id="ticket-priority"
                  value={form.priority}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, priority: event.target.value as TicketPriority }))
                  }
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  {TICKET_PRIORITIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ticket-category">Categoría</Label>
              <Input
                id="ticket-category"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ticket-description">Descripción</Label>
              <Textarea
                id="ticket-description"
                required
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                rows={5}
              />
            </div>
            {actionError && <p className="text-destructive text-sm">{actionError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editing ? "Guardar cambios" : "Crear ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={closeOpen}
        onOpenChange={(open) => {
          if (!saving) setCloseOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar ticket</DialogTitle>
            <DialogDescription>El motivo queda registrado junto con el actor y la fecha de cierre.</DialogDescription>
          </DialogHeader>
          <form onSubmit={confirmClose} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="close-reason">Motivo de cierre</Label>
              <Textarea
                id="close-reason"
                required
                value={closeReason}
                onChange={(event) => setCloseReason(event.target.value)}
                rows={4}
              />
            </div>
            {actionError && <p className="text-destructive text-sm">{actionError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCloseOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || !closeReason.trim()}>
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {saving ? "Cerrando…" : "Cerrar ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
