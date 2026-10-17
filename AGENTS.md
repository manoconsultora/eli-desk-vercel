# ELI Desk

El panel de las administraciones de consorcios: tickets, consorcios y unidades, residentes, solicitudes de alta y equipo. Next 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui y Supabase.

Estas reglas valen para cualquier persona o agente que trabaje en el repo.

## Contexto que no está en el código

- **La base no es de este repo.** El esquema y las migraciones viven en `eli-database-platform`. Desk no crea migraciones. Si un cambio de Desk necesita una migración nueva, se mergea primero la base; si la base borra algo que Desk usa, primero Desk.
- **Aislamiento por organización.** Toda consulta filtra por `organization_id` y, con scope `explicit`, por los consorcios asignados. La RLS es la última barrera, no la única.
- **Secretos.** No se leen ni se imprimen archivos `.env*`, claves ni tokens. La service role saltea la RLS: solo se usa del lado del servidor.
- **Diseño.** Los componentes de `src/components/ui/` (shadcn) se usan como vienen. Nada de valores arbitrarios de Tailwind (`text-[13px]`): la escala por defecto y los componentes compartidos.

## Convenciones

Las hacen cumplir Biome (`biome.json` y los plugins de `biome-plugins/`), knip, el hook de pre-commit y el CI. Esta lista explica el porqué.

| Convención | Regla |
| --- | --- |
| `type` en lugar de `interface` | `style/useConsistentTypeDefinitions` |
| `T[]` en lugar de `Array<T>` | `style/useConsistentArrayType` |
| `unknown` en lugar de `any` | `suspicious/noExplicitAny` |
| Una función con bloque va como `function`, no como arrow asignada a una constante | plugin `function-for-blocks.grit` |
| `filter`/`map`/`reduce`/`forEach` en lugar de loops. Un loop que espera (`await`) en cada vuelta sí va: pasarlo a `Promise.all` cambia el orden y la carga | plugin `no-loops.grit` |
| Desde 4 parámetros, un objeto | `nursery/useMaxParams` (máximo 3) |
| Nombres de archivo en `kebab-case` | `style/useFilenamingConvention` |
| No exportar lo que no se usa afuera, ni dejar código o dependencias sin uso | `knip` |
| Mensajes de commit con conventional commits (`feat:`, `fix:`, `chore:`…) | `commitlint` |

Una excepción se marca con `// biome-ignore <regla>: motivo`, siempre con el motivo. Para los plugins, la regla es `lint/plugin`.

El estilo de formato (comillas dobles, `;`, 120 columnas) lo aplica Biome; no se discute en review.

**Diferencias con eli-join, a propósito:**

- Desk usa Biome; Join, ESLint y Prettier.
- Desk permite 3 parámetros (Join, 2), porque las server actions que se usan con `.bind(null, x)` reciben `(x, prevState, formData)`.
- Desk no prohíbe los tipos de retorno explícitos: Biome no tiene una regla para eso.

## Antes de dar un cambio por terminado

```bash
pnpm exec biome ci   # formato y lint
pnpm deps:check      # knip
pnpm typecheck       # next typegen + tsc
pnpm test
```

El build lo valida el preview de Vercel de cada PR, porque necesita las variables de entorno reales.

## Compuertas

- **pre-commit:** regenera los temas y corre `biome check --write` sobre los archivos en stage.
- **commit-msg:** `commitlint`.
- **CI** (`.github/workflows/checks.yml`): los cuatro comandos de arriba y `commitlint` sobre los commits del PR. El repo no tiene protección de rama: el CI avisa, pero no bloquea el merge.
