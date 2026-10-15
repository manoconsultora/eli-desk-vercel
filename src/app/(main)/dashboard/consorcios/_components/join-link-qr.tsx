"use client";

import * as React from "react";

import { Check, Copy, Download, Loader2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { Button } from "@/components/ui/button";

function downloadQr(svgId: string, fileName: string) {
  const svg = document.getElementById(svgId);
  if (!svg) return;
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

// The same QR block in the creation dialog and in the Accesos tab.
export function JoinLinkQr({
  url,
  communityName,
  revokeLabel,
  busy,
  error,
  onRevoke,
}: {
  url: string;
  communityName: string;
  revokeLabel: string;
  busy: boolean;
  error: string | null;
  // Omitted for users who can only view (VIEWER).
  onRevoke?: () => void;
}) {
  const svgId = React.useId();
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="grid gap-4">
      <div className="flex justify-center rounded-xl border bg-white p-4">
        <QRCodeSVG id={svgId} value={url} size={200} marginSize={2} title={`QR de ${communityName}`} />
      </div>
      <p className="break-all rounded-lg border bg-muted/40 px-3 py-2 font-mono text-xs">{url}</p>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        {onRevoke ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            disabled={busy}
            onClick={onRevoke}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {revokeLabel}
          </Button>
        ) : (
          <span />
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => downloadQr(svgId, `qr-${communityName}.svg`)}
          >
            <Download className="size-4" />
            Descargar QR
          </Button>
          <Button type="button" disabled={busy} onClick={copy}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiado" : "Copiar link"}
          </Button>
        </div>
      </div>
    </div>
  );
}
