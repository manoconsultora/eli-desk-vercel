"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";

import dynamic from "next/dynamic";

import { claimFiscalEntry } from "@/lib/eli-chat/entry-session";
import type { FiscalSnapshot } from "@/lib/eli-chat/types";
import { type DeskFiscalInitial, getDeskFiscalInitial, postponeFiscalChat } from "@/server/desk-fiscal";
import type { UnitsSetup } from "@/server/desk-units-setup";

import { UnitsSetupDialog } from "../units-setup/units-setup-dialog";

const FiscalChat = dynamic(() => import("./fiscal-chat").then((module) => module.FiscalChat), { ssr: false });
const FiscalContext = createContext<{
  available: boolean;
  pending: boolean;
  error: string | null;
  open: () => void;
  postpone: () => void;
}>({
  available: false,
  pending: false,
  error: null as string | null,
  open: () => undefined,
  postpone: () => undefined,
});
export function useFiscalSetup() {
  return useContext(FiscalContext);
}

export function FiscalProvider({
  initial,
  unitsSetup,
  children,
}: {
  initial: DeskFiscalInitial;
  unitsSetup: UnitsSetup | null;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState(initial.snapshot);
  const [error, setError] = useState(initial.error);
  const [open, setOpen] = useState(false);
  const [unitsOpen, setUnitsOpen] = useState(false);
  const checked = useRef(false);
  const confirmed = useRef(Boolean(initial.snapshot?.confirmed_at));
  // Read when the fiscal chat confirms; the dialog then follows the refreshed prop.
  const noUnitsYet = useRef(false);
  noUnitsYet.current = unitsSetup?.loaded === 0;
  const pending = Boolean(snapshot && !snapshot.confirmed_at);
  const acceptSnapshot = useCallback((next: FiscalSnapshot) => {
    setSnapshot((current) =>
      !current || (current.organization_id === next.organization_id && next.revision >= current.revision)
        ? next
        : current,
    );
    setError(null);
    if (next.confirmed_at) {
      setOpen(false);
      // Confirming the fiscal data leads to loading the units, the last step of the initial setup.
      if (!confirmed.current && noUnitsYet.current) setUnitsOpen(true);
      confirmed.current = true;
    }
  }, []);

  useEffect(() => {
    if (checked.current || !initial.sessionKey || !initial.snapshot) return;
    checked.current = true;
    if (initial.snapshot.confirmed_at) return;
    try {
      if (claimFiscalEntry(window.localStorage, initial.sessionKey)) setOpen(true);
    } catch {
      setOpen(true);
    } // React lifetime still prevents repeated opens if storage is disabled.
  }, [initial]);

  useEffect(() => {
    async function refresh() {
      const result = await getDeskFiscalInitial();
      if (result.snapshot) acceptSnapshot(result.snapshot);
      else if (result.error) setError(result.error);
      else {
        setSnapshot(null);
        setOpen(false);
      }
    }
    // Focus refreshes truth without being treated as a new dashboard entry.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [acceptSnapshot]);

  const dismiss = useCallback(() => {
    setOpen(false);
    void postponeFiscalChat().catch(() => undefined); // A failed postpone never prevents using Desk.
  }, []);
  function openForm() {
    if (snapshot) setOpen(true);
    else
      void getDeskFiscalInitial().then((result) => {
        setError(result.error);
        if (result.snapshot) {
          acceptSnapshot(result.snapshot);
          setOpen(true);
        }
      });
  }
  return (
    <FiscalContext.Provider
      value={{ available: Boolean(snapshot || error), pending, error, open: openForm, postpone: dismiss }}
    >
      {children}
      {snapshot && (
        <FiscalChat key={snapshot.organization_id} open={open} onDismiss={dismiss} onSnapshot={acceptSnapshot} />
      )}
      {unitsSetup && <UnitsSetupDialog setup={unitsSetup} open={unitsOpen} onOpenChange={setUnitsOpen} />}
    </FiscalContext.Provider>
  );
}

export function FiscalAlertDot({ className = "", count }: { className?: string; count?: number }) {
  const { pending } = useFiscalSetup();
  const alertCount = count ?? (pending ? 1 : 0);
  return alertCount > 0 ? (
    <span
      role="img"
      aria-label={`${alertCount} ${alertCount === 1 ? "alerta pendiente" : "alertas pendientes"}: datos fiscales`}
      className={`pointer-events-none z-20 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 font-semibold text-[11px] text-white tabular-nums leading-none ${className}`}
    >
      {alertCount}
    </span>
  ) : null;
}
