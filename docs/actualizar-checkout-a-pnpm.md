# Actualizar un checkout local a pnpm y las compuertas nuevas

Instructivo para un agente (o una persona) que tiene que poner al día un checkout local de ELI Desk hecho antes del 17/10/2026, cuando entraron los PRs #50 a #56. Si clonaste el repo después, alcanza con `pnpm install`.

Seguí los pasos en orden. Cada paso trae su verificación: si una verificación no da lo esperado, **frená y reportá**. No improvises un arreglo.

## Qué cambió en `main`

| PR | Cambio | Qué te afecta |
| --- | --- | --- |
| #50 | Formato de Biome y clases de Tailwind ordenadas | Nada |
| #51 | Se borraron código muerto, 27 componentes de shadcn sin uso y 12 dependencias. Se sumó knip | Las ramas viejas que usen algo de eso no compilan |
| #52 | **npm pasa a pnpm 11.24.0**, Node 24 (`.nvmrc`), CI en GitHub Actions y commitlint | Hay que reinstalar todo con pnpm. Los mensajes de commit tienen que seguir conventional commits |
| #53 | Convenciones en Biome (`type`, `T[]`, sin `any`, sin loops, `function` en lugar de arrow con bloque, máximo 3 parámetros), `AGENTS.md` y `CLAUDE.md` | Firmas nuevas en tickets, consorcios y otros. Las reglas están en `AGENTS.md` |
| #54 | README nuevo de ELI Desk | Nada |
| #55 | Warnings de Biome en cero; el CI corre con `--error-on-warnings` | Un warning nuevo también hace fallar el CI |
| #56 | `engines.node: "24.x"` y `.npmrc` con `engine-strict` | `npm install` falla a propósito con `EBADENGINE` |

Commit de referencia: `main` en `7d1efb2` o posterior, con el CI `checks` en verde.

## Reglas para vos

- **Secretos:** no leas, no imprimas ni copies los archivos de entorno (`.env*`). El de tu máquina ya existe y queda como está.
- **Git:**
  - no uses `git stash` a secas: el stack de stash lo comparten todos los worktrees;
  - no hagas push a `main`, no mergees PRs y no corras nada contra la base remota de Supabase;
  - no borres ramas ni worktrees sin que te lo confirmen.
- **Archivos sin trackear:** si hay archivos sin trackear que no conocés, dejalos como están.

## Paso 1: herramientas

```bash
node -v      # tiene que ser v24.x
pnpm -v      # tiene que ser 11.24.0
```

- **Node no es 24:** corré `nvm use` en la carpeta del repo. Lee el `.nvmrc`.
- **No hay pnpm, o la versión es otra:** corré `corepack enable`. Corepack usa la versión de `packageManager` del `package.json`. Si corepack no está disponible, corré `npm i -g pnpm@11.24.0` fuera de la carpeta del repo.

**Verificación:** `node -v` empieza con `v24` y `pnpm -v` da `11.24.0`.

## Paso 2: actualizar `main`

En el checkout principal del repo:

```bash
git status --short          # anotá lo que hay antes de tocar nada
git switch main
git pull --ff-only origin main
git log --oneline -1        # 7d1efb2 o posterior
```

**Verificación:**

- `git status --short` muestra lo mismo que antes, sin archivos modificados nuevos;
- existen `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc`, `AGENTS.md` y `.github/workflows/checks.yml`;
- **no** existe `package-lock.json`. Si quedó uno sin trackear, de una instalación vieja, borralo.

## Paso 3: reinstalar con pnpm

Los `node_modules` instalados con npm no sirven: hay que borrarlos.

```bash
rm -rf node_modules .next
pnpm install --frozen-lockfile
```

`pnpm install` también activa los hooks de git, a través del script `prepare` (husky).

**Verificación:**

- la instalación termina sin errores;
- `git config core.hooksPath` da `.husky/_`.

Si pnpm pide aprobar scripts de build de algún paquete que no sea `esbuild` o `sharp`, frená y reportá. No los apruebes.

## Paso 4: correr los checks

Son los mismos cuatro que corre el CI:

```bash
pnpm exec biome ci --error-on-warnings   # 0 errores y 0 warnings
pnpm deps:check                          # knip, sin hallazgos
pnpm typecheck                           # next typegen + tsc, sin errores
pnpm test                                # todos pasan (168 o más), 0 fallan
```

**Verificación:** los cuatro terminan con código 0. Si alguno falla en `main` recién actualizado, frená y reportá la salida.

## Paso 5: probar los hooks

```bash
echo "cambios varios" | pnpm exec commitlint   # tiene que FALLAR (type-empty, subject-empty)
echo "chore: prueba" | pnpm exec commitlint    # tiene que pasar
```

No hagas un commit de prueba en `main`.

## Paso 6: levantar la app

```bash
pnpm dev
```

Usa el archivo de entorno que ya existe. Si antes la app corría en otro puerto, pasalo con `pnpm dev --port <puerto>`.

**Verificación:** el login carga en el navegador y, después de entrar, el dashboard muestra datos.

## Paso 7: ramas en curso (solo si las hay)

Para cada rama local con trabajo **sin mergear**:

```bash
git switch <rama>
git rebase origin/main
```

Conflictos que pueden aparecer y cómo resolverlos:

- **`package-lock.json`:** se borra (`git rm package-lock.json`). Las dependencias nuevas se agregan con `pnpm add <paquete>`, que actualiza `pnpm-lock.yaml`.
- **Archivos borrados en #51** que la rama usa: tienen que volver a la rama. Un componente de shadcn se agrega con `pnpm dlx shadcn@latest add <componente>`; si es otra cosa, reportalo.
- **Código en curso del onboarding y de `lib/access`:** no se borró. Está declarado en `.knip.jsonc`. Cuando se conecte a una pantalla, sacalo de ahí.
- **Firmas que cambiaron en #53:**

  | Antes | Ahora |
  | --- | --- |
  | `getTicketById(supabase, organizationId, scope, id)` | `getTicketById({ organizationId, scope, supabase }, id)` |
  | `createTicket(supabase, organizationId, scope, userId, input)` | `createTicket({ organizationId, scope, supabase }, userId, input)` |
  | `updateTicket` / `updateTicketStatus` / `closeTicket(supabase, org, scope, id, x)` | `(…)({ organizationId, scope, supabase }, id, x)` |
  | `getCommunityDetail(supabase, org, scope, communityId)` | `getCommunityDetail({ organizationId, supabase }, scope, communityId)` |
  | `createUnit` / `importUnits` / `updateUnit(supabase, org, id, x)` | `(…)({ organizationId, supabase }, id, x)` |
  | `addResidentToUnit(supabase, unitId, relationship, details)` | `addResidentToUnit(supabase, { unitId, relationship }, details)` |
  | `sendTeamInvitationEmail(config, to, email, send)` | `sendTeamInvitationEmail(config, { to, ...email }, { send })` |
  | `drainResidentEmailOutbox(admin, config, send, limit)` | `drainResidentEmailOutbox(admin, config, { send })` (el límite es fijo, 20) |

- **Reglas nuevas que la rama no cumpla:** `pnpm check:fix` arregla formato e imports. El resto se arregla a mano, siguiendo `AGENTS.md`:
  - `interface` pasa a `type`;
  - un loop pasa a `filter`/`map`/`reduce`/`forEach`;
  - una arrow con bloque pasa a `function`;
  - desde 4 parámetros, un objeto.

  Una excepción solo va con `// biome-ignore <regla>: motivo`.
- **Mensajes de commit** que no sigan conventional commits: el CI los marca. Al reescribir commits, usá `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `style:`, `test:` o `ci:`.

**Verificación por rama:** los cuatro checks del paso 4 dan verde. No hagas push sin que te lo pidan.

## Paso 8: ramas ya mergeadas (opcional)

```bash
git branch --merged origin/main
```

Esa lista muestra las ramas locales que ya están en `main`. No borres ninguna, ni ningún worktree, sin confirmarlo con quien te pidió la actualización. Si te lo confirman, borralas con `git branch -d <rama>`, nunca con `-D`.

## Comandos de todos los días

| Antes (npm) | Ahora (pnpm) |
| --- | --- |
| `npm install` | `pnpm install` |
| `npm install <paquete>` | `pnpm add <paquete>` (o `pnpm add -D` para desarrollo) |
| `npm run dev` | `pnpm dev` |
| `npm test` | `pnpm test` |
| `npx <bin>` | `pnpm exec <bin>` |
| `npx @biomejs/biome check --write` | `pnpm check:fix` |

Una versión nueva de un paquete no se instala hasta que tenga 7 días publicada (`minimumReleaseAge` en `pnpm-workspace.yaml`). Si `pnpm add` no encuentra la última versión, es por eso.

## Qué reportar al terminar

- **Herramientas:** las versiones de Node y pnpm.
- **Repo:** el commit de `main` y el `git status --short` final.
- **Checks:** el resultado de los cuatro y la cantidad de tests.
- **Hooks:** el resultado de la prueba de commitlint.
- **Ramas:** qué ramas se rebasaron y cuáles quedaron con conflictos o checks en rojo, con la salida.
