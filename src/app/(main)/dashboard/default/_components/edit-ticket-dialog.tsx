"use client";

import * as React from "react";

import { AlertCircle, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { type TicketRow, tagSuggestions, updateTicket, useEdificios } from "@/hooks/use-eli-data";
import { getSessionUser } from "@/lib/session";

interface EditTicketDialogProps {
  ticket: TicketRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export function EditTicketDialog({ ticket, open, onOpenChange, onUpdated }: EditTicketDialogProps) {
  const { edificios } = useEdificios();
  const [edificioId, setEdificioId] = React.useState("");
  const [ticketType, setTicketType] = React.useState("");
  const [priority, setPriority] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");
  const [closedReason, setClosedReason] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const originalDbStatus = React.useRef<string>("");

  React.useEffect(() => {
    if (ticket && open) {
      setEdificioId(ticket.edificio_id ?? "");
      setTicketType(ticket.ticket_type ?? "");
      setPriority(ticket.priority ?? "media");
      setStatus(ticket.status ?? "abierto");
      setDescription(ticket.description ?? "");
      setCategory(ticket.category ?? "");
      const existingTags = (ticket.data as any)?.tags ?? [];
      setTags(Array.isArray(existingTags) ? existingTags : []);
      setTagInput("");
      setClosedReason("");
      setError(null);

      const hasClosedAt = !!(ticket as any).closed_at;
      if (ticket.status === "cerrado" && !hasClosedAt) {
        originalDbStatus.current = "abierto";
      } else {
        originalDbStatus.current = ticket.status ?? "abierto";
      }
    }
  }, [ticket, open]);

  const isClosing = status === "cerrado" && originalDbStatus.current !== "cerrado";
  const alreadyClosed = status === "cerrado" && originalDbStatus.current === "cerrado";

  const suggestions = React.useMemo(() => {
    if (!ticketType) return [];
    return (tagSuggestions[ticketType] ?? []).filter((s) => !tags.includes(s));
  }, [ticketType, tags]);

  function addTag(tag: string) {
    const clean = tag.trim().toLowerCase();
    if (clean && !tags.includes(clean)) {
      setTags([...tags, clean]);
    }
    setTagInput("");
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
  }

  async function handleSave() {
    if (!ticket) return;
    if (!edificioId || !ticketType || !description.trim()) {
      setError("Completá consorcio, tipo y descripción.");
      return;
    }

    if (isClosing && !closedReason.trim()) {
      setError("Indicá el motivo de cierre para poder cerrar el ticket.");
      return;
    }

    setSaving(true);
    setError(null);

    const session = getSessionUser();
    const closedBy = session?.email || session?.name || "dashboard-admin";

    const updateFields: Record<string, unknown> = {
      ticket_type: ticketType,
      priority,
      status,
      category: tags[0] ?? category ?? null,
      data: { ...((ticket.data as object) ?? {}), tags, source: (ticket.data as any)?.source ?? "chatbot" },
    };

    if (isClosing) {
      updateFields.closed_reason = closedReason.trim();
      updateFields.closed_by = closedBy;
      updateFields.closed_at = new Date().toISOString();
    }

    const result = await updateTicket(ticket.id, updateFields);

    if (result.success) {
      const { supabase } = await import("@/lib/supabase");
      const extraFields: Record<string, unknown> = { description: description.trim() };
      if (edificioId !== ticket.edificio_id) {
        extraFields.edificio_id = edificioId;
      }
      await supabase.from("tickets").update(extraFields).eq("id", ticket.id);
    }

    setSaving(false);

    if (!result.success) {
      setError(result.error ?? "Error al guardar");
      return;
    }

    onOpenChange(false);

    // Notify vecino from the authenticated server boundary when closing a chatbot ticket.
    if (isClosing && ticket.data && (ticket.data as any).source !== "dashboard") {
      try {
        const notificationResponse = await fetch("/api/tickets/close-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: ticket.id,
            closedReason: closedReason.trim(),
          }),
        });

        if (!notificationResponse.ok) {
          toast.warning("El ticket se cerró, pero no se pudo enviar la notificación.");
        }
      } catch {
        toast.warning("El ticket se cerró, pero no se pudo enviar la notificación.");
      }
    }

    onUpdated?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar ticket
          </DialogTitle>
          <DialogDescription>{ticket?.ticket_code ?? ""}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Consorcio</Label>
            <Select value={edificioId} onValueChange={setEdificioId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar consorcio" />
              </SelectTrigger>
              <SelectContent>
                {edificios.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select value={ticketType} onValueChange={setTicketType}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reclamo">Reclamo</SelectItem>
                  <SelectItem value="urgencia">Urgencia</SelectItem>
                  <SelectItem value="consulta">Consulta</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger>
                  <SelectValue placeholder="Prioridad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alta">Alta</SelectItem>
                  <SelectItem value="media">Media</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="abierto">Abierto</SelectItem>
                  <SelectItem value="en_proceso">En proceso</SelectItem>
                  <SelectItem value="cerrado">Cerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isClosing && (
            <div className="grid gap-2 rounded-md border border-[#444] bg-[#333] p-3">
              <Label className="flex items-center gap-2 text-white">
                <AlertCircle className="h-4 w-4" />
                Motivo de cierre (obligatorio)
              </Label>
              <Textarea
                value={closedReason}
                onChange={(e) => setClosedReason(e.target.value)}
                placeholder="Describí por qué se cierra este ticket..."
                rows={2}
                className="border-[#444] bg-[#2a2a2a] text-white placeholder:text-gray-400"
                autoFocus
              />
            </div>
          )}

          {alreadyClosed && (
            <div className="rounded-md border border-muted bg-muted/50 p-3 text-sm text-muted-foreground">
              Este ticket ya fue cerrado.
            </div>
          )}

          <div className="grid gap-2">
            <Label>Descripción</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción del ticket..."
              rows={3}
            />
          </div>

          <div className="grid gap-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)} className="ml-0.5 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Escribí un tag y presioná Enter..."
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {suggestions.slice(0, 6).map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent text-xs"
                    onClick={() => addTag(s)}
                  >
                    + {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isClosing ? "Cerrar ticket" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
