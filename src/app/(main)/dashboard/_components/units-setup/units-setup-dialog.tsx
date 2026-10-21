"use client";

import Image from "next/image";

import { Check } from "lucide-react";

import { CreateUnitDialog } from "@/app/(main)/dashboard/consorcios/_components/create-unit-dialog";
import { ImportUnitsDialog } from "@/app/(main)/dashboard/consorcios/_components/import-units-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { UnitsSetup } from "@/server/desk-units-setup";

const STEPS = ["Datos fiscales", "Unidades"];

// Last step of the initial setup, right after the fiscal chat. Same window as "Primer consorcio" in
// the Landing onboarding; the units are loaded with the dialogs of the Consorcios page.
export function UnitsSetupDialog({
  setup,
  open,
  onOpenChange,
}: {
  setup: UnitsSetup;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const progress = setup.declared ? Math.min(100, Math.round((setup.loaded / setup.declared) * 100)) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-dvh gap-0 overflow-y-auto rounded-3xl p-0 sm:max-w-5xl lg:grid lg:grid-cols-5 lg:gap-3 lg:bg-muted lg:p-3"
      >
        <aside className="relative hidden overflow-hidden rounded-3xl bg-primary p-10 text-primary-foreground lg:col-span-2 lg:flex lg:flex-col lg:justify-between">
          <div className="-top-28 -right-20 absolute size-72 rounded-full border border-white/15" />
          <div className="-right-8 absolute top-12 size-44 rounded-full border border-white/10" />
          <span className="relative w-fit rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium text-white/80 text-xs">
            Último paso
          </span>
          <div className="relative">
            <p className="font-semibold text-white/65 text-xs uppercase tracking-widest">
              ELI para administraciones de Consorcios.
            </p>
            <p className="mt-6 text-6xl leading-none tracking-tighter">
              <span className="font-extrabold">Menos</span> <span className="font-thin">vueltas.</span>
              <br />
              <span className="font-extrabold">Más</span> <span className="font-thin">tiempo</span>
            </p>
          </div>
        </aside>

        <section className="flex flex-col rounded-3xl bg-background p-6 sm:p-10 lg:col-span-3">
          <ol aria-label="Configuración inicial" className="flex items-start">
            {STEPS.map((label, index) => {
              const completed = index < STEPS.length - 1;
              return (
                <li key={label} className="flex flex-1 items-start last:flex-none">
                  <div className="flex flex-col items-center gap-2">
                    <span
                      aria-current={completed ? undefined : "step"}
                      className={`flex size-8 items-center justify-center rounded-full border font-semibold text-xs ${
                        completed
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-primary bg-background text-primary ring-4 ring-primary/10"
                      }`}
                    >
                      {completed ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className="font-semibold text-xs">{label}</span>
                  </div>
                  {completed && <span className="mt-4 h-px flex-1 bg-primary" aria-hidden="true" />}
                </li>
              );
            })}
          </ol>

          <div className="mt-10">
            <p className="font-semibold text-primary text-xs uppercase tracking-widest">Configuración inicial</p>
            <DialogTitle className="mt-2 font-semibold text-4xl tracking-tight">Cargá las unidades</DialogTitle>
            <DialogDescription className="mt-2 text-base">
              Con las unidades cargadas, los vecinos eligen la suya al darse de alta y ELI ya puede operar.
            </DialogDescription>
          </div>

          <div className="mt-8 flex items-center gap-5 rounded-3xl border p-5">
            <Image src="/property-apartment.webp" alt="" width={96} height={96} className="size-24 object-contain" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{setup.name}</p>
              <p className="truncate text-muted-foreground text-sm">{setup.address}</p>
              <p className="mt-3 text-sm">
                <span className="font-semibold">{setup.loaded}</span>
                {setup.declared ? ` de ${setup.declared} unidades cargadas` : " unidades cargadas"}
              </p>
              {setup.declared ? <Progress value={progress} className="mt-2" aria-label="Unidades cargadas" /> : null}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <ImportUnitsDialog
              communityId={setup.communityId}
              communityName={setup.name}
              existingNumbers={setup.existingNumbers}
            />
            <CreateUnitDialog communityId={setup.communityId} communityName={setup.name} />
          </div>

          <div className="mt-10 flex items-center justify-between gap-3">
            <Button variant="ghost" className="h-11" onClick={() => onOpenChange(false)}>
              Lo hago después
            </Button>
            <Button className="h-11 px-6" disabled={setup.loaded === 0} onClick={() => onOpenChange(false)}>
              Ir al panel
            </Button>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
