// Same look as the ELI signup email (Resend): grey page, light card, logo on top, MANO at the foot.
// Copy follows the signup email's voice.
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

const ASSETS = "https://tnrmjgjtjzdiaomoeyat.supabase.co/storage/v1/object/public/eli/branding/logos";
const ELI_LOGO = `${ASSETS}/isologo_eli.svg`;
const MANO_LOGO = `${ASSETS}/isologo_mano_gy.png`;

const TEXT = "color:#555B65;font-size:16px;line-height:1.7;margin:0 0 16px;";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

type EmailContent = {
  subject: string;
  title: string;
  // Already escaped HTML, one per paragraph.
  paragraphs: string[];
  code?: string;
  note?: string;
  footer: string;
  text: string;
};

function layout({ title, paragraphs, code, note, footer }: EmailContent) {
  const body = paragraphs.map((paragraph) => `<p style="${TEXT}">${paragraph}</p>`).join("");
  const codeBlock = code
    ? `<p style="margin:10px 0 26px;text-align:center;font-size:34px;font-weight:700;letter-spacing:8px;color:#2346DD;">${code}</p>`
    : "";
  const noteBlock = note ? `<p style="color:#7A808A;font-size:14px;line-height:1.6;margin:0 0 16px;">${note}</p>` : "";
  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${title}</title></head>
<body style="margin:0;padding:0;background-color:#F1F2F0;font-family:Arial,Helvetica,sans-serif;color:#414650;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F1F2F0;"><tr><td align="center" style="padding:40px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background-color:#F7F7F5;"><tr><td style="padding:44px 36px 36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding-bottom:44px;">
<img src="${ELI_LOGO}" alt="ELI" width="150" style="display:block;width:150px;max-width:100%;height:auto;border:0;" />
</td></tr></table>
<h1 style="color:#414650;font-size:25px;line-height:1.3;font-weight:700;margin:0 0 26px;">${title}</h1>
${body}${codeBlock}${noteBlock}
<p style="color:#9A9FA8;font-size:12px;line-height:1.6;margin:40px 0 24px;">${footer}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">
<img src="${MANO_LOGO}" alt="MANO Consultora" width="82" style="display:block;width:92px;max-width:100%;height:auto;border:0;" />
</td></tr></table>
</td></tr></table>
</td></tr></table>
</body>
</html>`;
}

function content(key: ResidentEmailTemplateKey, payload: ResidentEmailPayload): EmailContent {
  const rawBuilding = payload.edificio_nombre ?? "tu edificio";
  const building = escapeHtml(rawBuilding);
  const name = escapeHtml(payload.first_name ?? "");
  const unitText = payload.unidad_numero ? ` (unidad ${payload.unidad_numero})` : "";
  const unit = escapeHtml(unitText);
  const footer = `Recibís este email porque pediste el alta en ${building} con ELI.`;

  if (key === "resident_email_verification") {
    const code = payload.code ?? "";
    return {
      subject: `Tu código de verificación de ELI: ${code}`,
      title: "Confirmá tu email",
      paragraphs: ["¡Hola!", `Usá este código para confirmar tu email y pedir el alta en ${building}:`],
      code: escapeHtml(code),
      note: "Vence en 30 minutos. Si no lo pediste, ignorá este email.",
      footer: `Recibís este email porque alguien pidió el alta en ${building} con esta dirección.`,
      text: `¡Hola!\n\nUsá este código para confirmar tu email y pedir el alta en ${rawBuilding}: ${code}\n\nVence en 30 minutos. Si no lo pediste, ignorá este email.`,
    };
  }
  if (key === "resident_request_approved") {
    return {
      subject: "Tu cuenta de ELI está activa",
      title: "Tu cuenta de ELI está activa",
      paragraphs: [
        `¡Hola, ${name}!`,
        `La administración aprobó tu solicitud de alta en ${building}${unit}. Ya podés empezar a utilizar ELI.`,
      ],
      footer,
      text: `¡Hola, ${payload.first_name ?? ""}!\n\nLa administración aprobó tu solicitud de alta en ${rawBuilding}${unitText}. Ya podés empezar a utilizar ELI.`,
    };
  }
  if (key === "resident_request_rejected") {
    return {
      subject: "Tu solicitud de alta en ELI no fue aprobada",
      title: "Tu solicitud no fue aprobada",
      paragraphs: [
        `¡Hola, ${name}!`,
        `La administración no aprobó tu solicitud de alta en ${building}${unit}.`,
        "Si creés que es un error, comunicate con la administración del edificio.",
      ],
      footer,
      text: `¡Hola, ${payload.first_name ?? ""}!\n\nLa administración no aprobó tu solicitud de alta en ${rawBuilding}${unitText}.\n\nSi creés que es un error, comunicate con la administración del edificio.`,
    };
  }
  // A template the database added before this Desk knows it: the drain marks the email failed and
  // retries it, so it goes out once Desk is deployed instead of being sent as another email.
  throw new Error(`unknown_template:${String(key)}`);
}

export function renderResidentEmail(key: ResidentEmailTemplateKey, payload: ResidentEmailPayload) {
  const email = content(key, payload);
  return { subject: email.subject, html: layout(email), text: email.text };
}
