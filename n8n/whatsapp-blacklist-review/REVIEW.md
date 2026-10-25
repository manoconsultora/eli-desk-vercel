# ELI WhatsApp V3 blacklist — consulta autenticada y copia local

STATUS: IMPLEMENTED LOCALLY — READY FOR REVIEW WITH BASELINE CHECK ISSUE

La dependencia de código pendiente quedó implementada: existe una ruta ELI Server
`POST /api/integrations/n8n/v1/messages.authorize`, autenticada por SEC-01 y
conectada en el borrador local. **No está desplegada. El V3 activo no fue editado,
importado, activado, publicado ni ejecutado.**

## Aislamiento y backup conservados

- Worktree: `02_build/2-dashboard/.worktrees/eli-v3-whatsapp-blacklist-review`.
- Branch: `agent/eli-v3-whatsapp-blacklist-review`.
- HEAD/base sin cambios: `2af111aa0cc2ce7e0b4a5accdd81f949f62c9d0e`.
- Sin commit, push, merge, publicación ni despliegue.
- Backup original conservado en host:
  `/home/ubuntu/apps/n8n/v3-backup-blacklist-20261024T220046Z.json`, modo 0600.
- Export privado local `.private/v3-original.json`, ignorado, archivo 0600 y
  directorio 0700. No se regeneró, descifró ni publicó ese backup.
- Esta continuación no usó SSH, navegador, Supabase ni herramientas de n8n.
  Todos los cambios y las pruebas ocurrieron en el worktree existente.
- Desk UI/gestión, Join, API de tickets, esquema/RLS, datos, V2, ORI LEADS y V3
  activo no fueron modificados. El checkout compartido permanece fuera del diff.

La verificación remota anterior registró V3 activo en
`f2acc514-0729-4146-b815-50c8171dd0ec` con Telegram Trigger deshabilitado;
V2 activo en `7a11a6a9-7a88-4a18-9798-910c989d48fd`; ORI LEADS despublicado.
Esta continuación no volvió a acceder a esos recursos ni afirma una auditoría
remota nueva.

## Diff de esta continuación

Se agregaron seis archivos de aplicación, limitados a la integración bot:

1. `src/app/api/integrations/n8n/v1/messages.authorize/route.ts`.
2. `src/server/bot-message-access/request-handler.ts`.
3. `src/server/bot-message-access/phone-blacklist-repository.ts`.
4. `src/server/bot-message-access/request-handler.test.ts`.
5. `src/server/bot-message-access/phone-blacklist-repository.test.ts`.
6. `src/server/bot-message-access/route.test.ts`.

La ruta reutiliza la lectura acotada del body, verificador SEC-01, registro de
claves, ledger de nonce y repositorio de identidad existentes. El principal se
obtiene del verificador real, nunca de un objeto recibido en el body. Se exige
el mismo principal técnico DEV autorizado en la integración actual. Las firmas
se ligan al nuevo path; no se reutiliza la firma de tickets.create.

El repositorio nuevo es una consulta de solo lectura sobre el modelo EXISTENTE
`resident_blacklist`. Reutiliza los filtros `organization_id`, `removed_at IS NULL`
y teléfono canónico exacto del mecanismo PostgREST de Desk / trigger de Join.
No hay blacklist paralela, tabla, migración, modificación de RPC o escritura de
negocio. SEC-01 conserva su reserva técnica de nonce cuando la ruta se ejecute;
las pruebas usan un ledger en memoria y no escriben en Supabase.

La administración deriva exclusivamente de una relación activa y coherente entre
canal/residente/administración/unidades. Se rechazan identidades no resueltas,
ambiguas, inactivas, bloqueadas, estados desconocidos y relaciones entre tenants.
No se selecciona ni altera 1A o 4B. Cada mensaje vuelve a consultar la blacklist.
La respuesta no contiene datos personales, tenant, motivo ni detalles de errores.
No se cachea el acceso.

En artefactos n8n:

- Se eliminó `server-adapter.mjs`, reemplazado por los módulos reales anteriores.
- `v3-blacklist.draft.json` y su generador indican endpoint implementado localmente
  y despliegue pendiente; el HTTP usa el nuevo path `messages.authorize`.
- Los Code nodes se conservan como fragmentos `.js.txt`, insertados en el JSON;
  así no se confunden con módulos ejecutables independientes.
- Las pruebas de workflow pasan al nuevo contrato y validan la copia inactiva.
- `.knip.jsonc` registra únicamente el generador de la copia como entrada de
  herramientas. No se agrega un ignore para ocultar exports o código del servidor.
- `workflow.diff` contiene el diff completo baseline saneado → copia actual.
- `server.diff` contiene los seis archivos nuevos del servidor y su ajuste mínimo
  de herramientas. Los dos diffs son material para revisión, no patches publicados.

## Comportamiento de rechazo

Una respuesta explícita blocked de la consulta autenticada produce exactamente:

`[BL] Acceso Denegado. Recomendamos contactar al Administrador de tu Edificio.`

La rama finaliza después de la respuesta; no alcanza al clasificador ni a una
capacidad. Scope o consulta no verificables, HTTP fallido, JSON desconocido,
correlación incorrecta o timeout producen servicio no disponible y cierran el paso.
El contexto y destinatario se recuperan por item linking, incluso en lotes.
Los estados de entrega siguen ignorados. Multimedia pasa el control antes de
recibir una respuesta de tipo no soportado.

Join mantiene su mensaje actual y su bloqueo por email O teléfono; WhatsApp
comprueba el teléfono verificado según lo pedido. Las reglas de gestión de Desk,
la vigencia por removed_at y el alcance por administración permanecen iguales.

## Verificación ejecutada

| Comprobación | Resultado |
| --- | --- |
| Pruebas nuevas de servidor | PASS — 51: SEC-01 real, firma/path/tiempo inválidos, replay, principal incorrecto, body estricto, aislamiento, filtros, errores y reconsulta por mensaje |
| Respuesta del handler real → Code node real de V3 | PASS — permitido/bloqueado/indisponible, texto exacto y destinatario conservado; repositorios simulados |
| Fixtures y grafo de workflow | PASS — 11: contexto, cierre del paso, statuses, multimedia, triggers apagados, ruta y contrato conectados |
| Suite completa con Node 24.22.1 | PASS — 236 pruebas / 0 fallos; node24-full-tests.log |
| TypeScript / tipos de rutas Next con Node 24 | PASS — next typegen + tsc --noEmit; node24-typecheck.log |
| Biome global con Node 24 y warnings como error | PASS — sin errores; node24-biome.log |
| git diff --check | PASS — sin errores de whitespace |
| knip / deps:check con Node 24 | FAIL PREEXISTENTE REPRODUCIDO — base y worktree dan exactamente los mismos dos exports; ver abajo |
| Build / Preview | NOT RUN — no se leyó configuración privada ni se hizo despliegue |
| Supabase/RLS reales, firma y consulta contra entorno remoto | NOT RUN — fuera de esta entrega local |
| Motor n8n, error HTTP/timeout real y entrega WhatsApp | NOT RUN — copia no importada ni ejecutada |
| Persistencia de tickets y reintentos | NOT RUN — no se crearon ni reintentaron tickets |

Los comandos equivalentes a los scripts del proyecto se ejecutaron con las
herramientas ya instaladas. El wrapper pnpm intentó su comprobación/instalación de
dependencias y falló con `spawnSync pnpm ENOENT`; no se instaló nada ni se alteraron
dependencias compartidas. Se usaron los binarios existentes para ejecutar los
mismos tests, typegen/tsc, Biome y knip inicialmente con Node v22.17.1. Esa
limitación queda resuelta por la validación posterior con Node 24.22.1 documentada
a continuación. No se modificó la instalación Node del sistema ni se instalaron
dependencias del proyecto.

Evidencia: `server-verification.tap`, `verification.tap`, `full-tests.log`,
`typecheck.log`, `biome-ci.log`, `knip.log`.

### Hallazgo de baseline conservado

Knip señala:

- `BotTicketRepositoryError` — `src/server/tickets/bot-ticket-repository.ts:15`.
- `SupabaseBotTicketPersistence` — mismo archivo, línea 22.

Ambos exports se reprodujeron ejecutando Knip sobre la base inmutable y sobre el
worktree con Node 24. Los logs son idénticos byte por byte, ambos con exit code 1.
El archivo también es idéntico byte por byte a la base, y su diff Git está vacío.
No se modificó ninguno de esos exports. El generador n8n está registrado, y Knip
no informa archivos o exports nuevos sin uso de esta integración.

## Validación Node 24 y contraste contra la rama base

Se utilizó el binario portable oficial **Node v24.22.1**, `darwin-arm64`, en
`/private/tmp/eli-node24-validation/node-v24.22.1-darwin-arm64/bin/node`.
Su archivo oficial es
`https://nodejs.org/dist/v24.22.1/node-v24.22.1-darwin-arm64.tar.gz`.
La descarga se verificó contra `SHASUMS256.txt` de nodejs.org:
`89c682593d76cd44233fa53b1563264e7de9cbb189cad169135c5b4fadfbc0a7`.
No se cambió el Node global y no se leyó configuración privada del entorno.

Resultados usando Node 24 explícito y sus entrypoints JavaScript reales, evitando
interpretar como JavaScript los shims de shell de node_modules/.bin:

- Suite completa: 236 PASS, 0 FAIL.
- Fixtures/grafo del workflow: 11 PASS, 0 FAIL.
- Next typegen + TypeScript: PASS.
- Biome ci con warnings como error: PASS.
- Knip: los mismos dos exports de baseline en ambas ejecuciones, exit code 1.

La rama base comprobada es `agent/eli-n8n-dev-deploy-prep`, commit
`2af111aa0cc2ce7e0b4a5accdd81f949f62c9d0e`; también es el merge-base y HEAD de
esta rama de revisión. Se extrajo una instantánea limpia de ese commit mediante
`git archive` a `/private/tmp/eli-node24-validation/base-2af111a`. No se hizo
checkout ni se modificó la rama base. Se usaron las mismas dependencias existentes
y la misma versión de Knip, sin instalar ni editar dependencias.

Prueba del archivo de los exports:

- Git blob en base: `ca4464bf6f5f9660724f02a3881e93008a12b805`.
- Git blob en worktree después de verificar: el mismo.
- SHA-256 del archivo en ambos árboles:
  `531113280b875e32bfa9ea90e4a6c951e0965b282ed7f8d3c46970b1c7592258`.
- `git diff -- src/server/tickets/bot-ticket-repository.ts`: vacío.

Evidencia adicional retenida junto a este informe:
`node24-runtime.json`, `node24-validation.json`, `node24-full-tests.log`,
`node24-workflow-tests.log`, `node24-typecheck.log`, `node24-biome.log`,
`node24-knip-base.log` y `node24-knip-worktree.log`.

La comprobación solicitada de Node 24 y preexistencia de exports queda completa.
No se corrigieron esos exports y no se hicieron commits, publicaciones o despliegues.

## Dependencias y límites pendientes de revisión

La dependencia de implementar la ruta está resuelta en código local. Quedan:

1. Revisar el diff y resolver el fallo de Knip confirmado en la rama base en su
   alcance propio. La validación con Node 24 ya está completada.
2. Autorización separada para cualquier despliegue DEV. El Preview actual no
   contiene la ruta; ejecutarlo ahora devolvería indisponibilidad.
3. Autorización separada para importar una copia inactiva de V3, vincular en privado
   credenciales/ID Meta y comprobar el motor, RLS y respuestas en DEV. Activar o
   publicar sigue explícitamente fuera del alcance de esta entrega.
4. La preconsulta no concede un token durable ni una autorización transaccional de
   tickets: una modificación de blacklist entre consulta y capacidad conserva la
   ventana ya documentada. La API de tickets no fue modificada; cualquier cierre
   adicional de esa ventana requiere revisar y autorizar esa capacidad por separado.

No se solicitó un mensaje humano de prueba ni se envió una respuesta por WhatsApp.
El resultado es código y workflow aislados listos para revisión, no una integración
activada.

EXECUTION_STATUS: COMPLETE_FOR_REVIEW

## Autorización posterior: commit y Preview exclusivo ELI-DEV

El humano autorizó repetir Node 24 / 236 pruebas / 11 fixtures / TypeScript / Biome,
crear un commit, publicar únicamente esta rama y desplegar solo Preview contra
ELI-DEV. Esta autorización sustituye la restricción anterior de commit/despliegue;
no autoriza merge, Production, publicación/activación de V3, mensajes ni tickets.
Se agregó esta rama a deploymentEnabled=false en vercel.json para conservar el
control del despliegue manual y verificar sus variables antes de construir.
El resultado de despliegue, URL y SHA se retendrán en el checkpoint Harness.
