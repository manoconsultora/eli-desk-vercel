# WhatsApp V3 blacklist — implementación local para revisión

La operación `POST /api/integrations/n8n/v1/messages.authorize` está implementada
en este worktree y conectada en el borrador local. **No está desplegada. El V3
activo no fue modificado.** La copia permanece inactiva y con triggers apagados.

## Ubicación y archivos

Branch `agent/eli-v3-whatsapp-blacklist-review`, base `2af111a`.

- `src/app/api/integrations/n8n/v1/messages.authorize/route.ts`: ruta Node.js DEV.
- `src/server/bot-message-access/request-handler.ts`: autenticación SEC-01,
  autorización del principal, contrato estricto y administración verificada.
- `src/server/bot-message-access/phone-blacklist-repository.ts`: lectura acotada.
- Tres archivos de pruebas junto a esos módulos.
- `v3-blacklist.draft.json`: copia local importable para revisión.
- `v3-baseline.sanitized.json`: referencia saneada; no importar como workflow.
- `workflow.diff`: diferencia entre referencia y copia de trabajo.
- `prepare-check.js.txt` / `evaluate-check.js.txt`: cuerpos de Code nodes; `.txt`
  indica que son fragmentos n8n, no módulos JavaScript independientes.
- `build-draft.mjs`: generador local registrado como entrada de herramientas en
  `.knip.jsonc`. No se ejecuta desde la aplicación.
- `verification.tap`, `server-verification.tap`, `full-tests.log`,
  `typecheck.log`, `biome-ci.log`, `knip.log`: resultados de verificación.
- `REVIEW.md`: entrega actual, límites y pendientes.

El prototipo anterior `server-adapter.mjs` fue reemplazado por los módulos reales;
no queda una implementación paralela en los artefactos.

## Modelo existente reutilizado

`public.resident_blacklist` es la única fuente de bloqueo. Se conserva el filtro
`organization_id` y `removed_at IS NULL` de `listBlacklist` de Desk, junto con
la coincidencia exacta de dígitos de `private.phone_digits` usada por Join.
La consulta proyecta solo `id, phone_digits`, filtra el teléfono y limita a una
fila. No filtra por edificio, no usa sufijos, no agrega tabla, RPC o regla de gestión.

Join continúa mostrando su mensaje vigente para `CONTACT_BLOCKED`; no se lo
modificó. Su regla también permite bloquear por email. WhatsApp comprueba el
**teléfono del remitente verificado**, como se solicitó; no infiere email del chat.
Una fila retirada o perteneciente a otra administración no bloquea ese teléfono.

## Autenticación y alcance

1. Solo el entorno configurado `dev` habilita esta ruta. En `prod`, desconocido o
   sin configuración devuelve indisponibilidad.
2. Reutiliza `readBoundedRawBody` y el verificador SEC-01 real: dominio
   `ELI-N8N-BOT-API-V1`, POST, path efectivo, bytes, hash, key ID, timestamp,
   requestId y nonce. Una firma de tickets.create no sirve para esta ruta.
3. Solo admite el principal técnico vigente `integration:n8n` / `n8n-bot-dev`,
   entorno DEV, sin autoridad tenant o de negocio concedida por el principal.
4. El body no puede indicar organización, unidad, permiso ni principal. Se
   rechazan campos extra, canales diferentes de WhatsApp y teléfonos no canónicos.
5. El repositorio de identidad ya existente resuelve la fila de canal y su
   residente, administración y vínculos. Una única relación activa y coherente
   determina la administración. Cero/múltiples relaciones, estado desconocido,
   inactivo, bloqueado o inconsistencias tenant cierran el paso sin consultar
   blacklist fuera del alcance verificado.
6. 1A y 4B activas del mismo residente/administración son válidas para este
   prechequeo. No se elige, modifica ni elimina una unidad. La API de tickets
   conserva su resolución y validaciones propias.
7. La blacklist se consulta de nuevo para cada mensaje. No se cachea el permiso,
   y la respuesta lleva `Cache-Control: no-store, private`.

La consulta de datos de negocio es de solo lectura. SEC-01 conserva su mecanismo
existente de reserva de nonce en el ledger de seguridad cuando se ejecute en un
entorno autorizado. En estas pruebas el ledger y Supabase se simularon: no se
escribió ni consultó ninguna base remota ni se descifraron credenciales.

## Contrato implementado

Body:

```json
{
  "apiVersion": "v1",
  "capability": "messages.authorize",
  "correlationId": "wa-<message-id>",
  "source": { "channel": "whatsapp", "externalSenderId": "<digits>" }
}
```

Respuesta de consulta correcta, HTTP 200:

```json
{
  "apiVersion": "v1",
  "capability": "messages.authorize",
  "correlationId": "wa-<message-id>",
  "decision": "allowed"
}
```

Un teléfono bloqueado devuelve `decision: "blocked"`, también HTTP 200.
Indisponibilidad: `decision: "unavailable"` con HTTP 503; auth inválida 401,
principal no autorizado 403, replay 409, contrato inválido 422 y body inválido o
excesivo 400/413. No se devuelve identidad, organización, motivo ni contacto.

## Flujo de la copia de V3

```text
Meta HMAC → normalizar mensaje → preparar consulta → cadena SEC-01 clonada
  → messages.authorize → validar status/contrato/correlationId
      allowed + texto → clasificador → capacidad existente
      blocked         → texto [BL] exacto → fin
      unavailable     → servicio no disponible → fin
      allowed + media → tipo no soportado → fin
```

Texto exacto de bloqueo:

`[BL] Acceso Denegado. Recomendamos contactar al Administrador de tu Edificio.`

Los errores HTTP, timeout de 10 s, respuesta desconocida, JSON inválido o
correlación diferente producen indisponibilidad. El contexto se recupera por item
linking, no por la posición cero de un lote. El remitente, destinatario, canal,
phoneNumberId, correlationId e idempotencyKey permanecen asociados a cada mensaje.
Los eventos `statuses` no generan items, tickets ni respuestas conversacionales.
El ACK HTTP de transporte de Meta conserva su funcionamiento previo.

La URL del borrador usa el path implementado y el host Preview DEV de referencia.
**Ese despliegue todavía no contiene la ruta nueva.** No ejecutar esta copia
contra él hasta una revisión y un despliegue autorizados por separado.

## Generación y pruebas locales

El generador requiere el original privado ignorado `.private/v3-original.json`.
Después de regenerar, formatear los dos JSON con Biome y regenerar `workflow.diff`.
Los nuevos IDs de nodos/webhooks impiden colisiones con el workflow activo.

```sh
node n8n/whatsapp-blacklist-review/build-draft.mjs
node_modules/.bin/biome format --write n8n/whatsapp-blacklist-review/v3-*.json
node --test n8n/whatsapp-blacklist-review/blacklist.test.mjs
node --conditions react-server --import tsx --test src/server/bot-message-access/*.test.ts
```

Las credenciales de la copia son placeholders de revisión y todos sus triggers
están deshabilitados. No se debe activar ni publicar para validar esta entrega.

La ruta autenticada, filtros, cierre ante fallos y respuesta efectiva del servidor
al evaluador V3 tienen pruebas locales. El motor n8n, Supabase/RLS reales, timeout
real y entrega WhatsApp siguen NOT RUN. Ver resultados y pendientes en REVIEW.md.
