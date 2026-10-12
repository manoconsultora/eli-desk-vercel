"use client";

import * as React from "react";

import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// After inviting or resending: whether the email went out, and the link to share it another way.
export function InvitationLink({ email, link, emailSent }: { email: string; link: string; emailSent: boolean }) {
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <div className="grid gap-3">
      <p className="text-sm">
        {emailSent
          ? `Le mandamos la invitación a ${email}. También podés compartirle este link:`
          : `No pudimos mandar el mail a ${email}. Compartile este link por otro medio:`}
      </p>
      <div className="flex gap-2">
        <Input readOnly value={link} aria-label="Link de la invitación" onFocus={(event) => event.target.select()} />
        <Button type="button" variant="outline" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">Vence en 7 días. Si la reenviás, este link deja de servir.</p>
    </div>
  );
}
