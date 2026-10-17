# ELI Desk

El panel de las administraciones de consorcios de ELI: tickets, consorcios y unidades, residentes, solicitudes de alta y equipo.

Next 16 (App Router), React 19, TypeScript, Tailwind 4, shadcn/ui y Supabase. El esquema de la base vive en [`eli-database-platform`](https://github.com/manoconsultora/eli-database-platform).

Las convenciones, los checks y el contexto para trabajar en el repo están en [`AGENTS.md`](AGENTS.md).

## Correr en local

Requiere Node 24 (`.nvmrc`) y pnpm 11 (`packageManager` en `package.json`).

```bash
pnpm install   # también activa los hooks de git
pnpm dev
```

Las variables de entorno van en `.env.local`, que no se versiona.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo |
| `pnpm test` | Tests (`node:test` con `tsx`) |
| `pnpm typecheck` | `next typegen` + `tsc` |
| `pnpm deps:check` | Código y dependencias sin uso (knip) |
| `pnpm check:fix` | Formato, lint e imports con Biome |

## Supabase keepalive

`GET /api/keepalive/supabase` evita que se pause un proyecto de Supabase en un plan que pausa los proyectos inactivos. Ver [docs/supabase-keepalive.md](docs/supabase-keepalive.md).

## Licencia

El proyecto nació de la plantilla [next-shadcn-admin-dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard), con licencia MIT (ver [`LICENSE`](LICENSE)).
