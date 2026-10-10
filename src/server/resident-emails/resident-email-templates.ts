// Provisional copy: replace subject and body when the final texts are ready.
export type ResidentEmailTemplateKey =
  | "resident_request_approved"
  | "resident_request_rejected"
  | "resident_email_verification";

export type ResidentEmailPayload = {
  first_name?: string;
  edificio_nombre?: string;
  unidad_numero?: string;
  code?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

export function renderResidentEmail(key: ResidentEmailTemplateKey, payload: ResidentEmailPayload) {
  const name = escapeHtml(payload.first_name ?? "");
  const building = escapeHtml(payload.edificio_nombre ?? "tu edificio");
  const unit = payload.unidad_numero ? ` (unidad ${escapeHtml(payload.unidad_numero)})` : "";

  if (key === "resident_email_verification") {
    const code = escapeHtml(payload.code ?? "");
    return {
      subject: `Tu código de verificación de ELI: ${payload.code ?? ""}`,
      html: `<main><p>Tu código para pedir el alta en ${building} es:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>Vence en 30 minutos. Si no lo pediste, ignorá este email.</p></main>`,
    };
  }
  if (key === "resident_request_approved") {
    return {
      subject: `Ya sos parte de ${payload.edificio_nombre ?? "tu edificio"} en ELI`,
      html: `<main><p>Hola ${name}:</p><p>La administración aprobó tu solicitud de alta en ${building}${unit}.</p></main>`,
    };
  }
  if (key === "resident_request_rejected") {
    return {
      subject: "Tu solicitud de alta en ELI no fue aprobada",
      html: `<main><p>Hola ${name}:</p><p>La administración no aprobó tu solicitud de alta en ${building}${unit}.</p></main>`,
    };
  }
  // A template the database added before this Desk knows it: the drain marks the email failed and
  // retries it, so it goes out once Desk is deployed instead of being sent as another email.
  throw new Error(`unknown_template:${String(key)}`);
}
