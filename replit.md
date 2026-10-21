# مخزون نمري

تطبيق عربي لإدارة مستودعات شركة نمري للمقاولات، ومتابعة المواد والأرصدة والحركات والمشاريع والتقارير.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/namri-inventory` — responsive Arabic RTL web application
- `artifacts/api-server` — Express API and Clerk session authentication
- `lib/api-spec/openapi.yaml` — API source contract; regenerate clients with the command above
- `lib/db/src/schema/namri-inventory.ts` — PostgreSQL schema for warehouses, stock, projects, users, and movements

## Architecture decisions

- Clerk handles sign-in; application roles are stored and enforced server-side in PostgreSQL.
- The first signed-in account becomes the initial administrator in each environment. Development and production users and role records are separate.
- Admins can create warehouses and items, manage roles, download backups, and approve or reject receipt/issue requests; warehouse managers can submit requests and record counts.
- Receipts and issues remain pending and do not change stock until an admin approves them; physical-count adjustments are recorded directly in the ledger.
- Inventory value uses each warehouse's weighted average unit cost; unpriced stock is shown as zero until a cost is entered.
- Only the two required warehouse records are initialized automatically; real item quantities and projects are not fabricated.

## Product

The app provides warehouse-level stock balances, low-stock alerts, project-linked issues, receipt records, stock counts, movement history, dashboard analytics, and export-ready reports.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after every OpenAPI contract change.
- Use the managed artifact workflows for the web app and API server; do not start duplicate dev workflows.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
