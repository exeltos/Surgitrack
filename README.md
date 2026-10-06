# SurgiTrack

Traceability for surgical instruments and instrument Sets: from the department to sterilization and back, with a
full history of every movement. Web app (React, TypeScript, Vite) on a Supabase backend (Postgres with row level
security, auth, edge functions). Greek and English.

## What it does

- **Registry** of Sets and instruments (barcodes, composition, usage limits, colour tapes, owners), bulk import from Excel/CSV, name check.
- **Sterilization workspace**: receipt, washing, preparation, packaging, load/cycle, release and delivery, each with its records; recalls.
- **Devices**: sterilizers and washers send cycle data over the network, by file or by serial printout.
- **Issues, replacements and purchase orders**: reports of damage or loss, replacement from Stock, orders and their receipt.
- **Reports, history and traceability** by barcode or patient code; **Overview** dashboard; **Recycle bin** (30 days) for deleted Sets and instruments.
- **Roles**: Admin, Sterilization, Department, Viewer (read-only); hospital admins manage people and departments; a platform owner manages hospitals (Studio).

## Run it

```bash
nvm use            # Node 22
npm ci
cp .env.example .env.local   # VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

The build needs those two variables. Demo mode (a sample hospital that exists only in Demo organizations) is chosen at sign-in. `npm run ci` is what GitHub Actions
runs: format, typecheck (`tsc -b`), lint, tests, build (see `CI_CHECKS.md`).

## How it is organised

| Path                  | What lives there                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `src/modules/<page>`  | One folder per page (Sets, Tools, Sterilization, Issues, Devices, Studio, …)                   |
| `src/components`      | Shared UI (`ui/`: buttons, empty states, confirm dialog), asset components, layout shell       |
| `src/store`           | The app state, built slice by slice (`slices/`); `SurgiStore.tsx` exposes it with `useSurgi()` |
| `src/core`            | Pure logic with tests: permissions, replacements, recycle bin, name check, workflow, imports   |
| `src/data`            | Demo data and the cloud layer: `cloud/cloudTables.ts` maps each store collection to its table  |
| `src/i18n`            | `tr('Ελληνικό κείμενο')` returns the English text from `en.ts` when the language is English    |
| `src/styles`          | Global CSS in layers; the last block of `global.css` holds the shared look (headers, buttons)  |
| `supabase/migrations` | Every schema change in order (see `supabase/MIGRATIONS.md`)                                    |
| `supabase/functions`  | Edge functions (staff sign-up and invitations, device ingest, handover verification, …)        |

Data flow: the store holds records in memory; in a cloud workspace each collection is mirrored to its table by
`useAppRecordSync` (changed records are written, removed ones deleted, failed writes retried).

## Security model

- Row level security on every table; `anon` has no table privileges. Access is by hospital (`current_org_id()`) and role (`app_record_writable`, `is_cssd_operator`, `is_viewer`); an ended trial locks a hospital for its users.
- Privileged actions go through edge functions with the service role or `security definer` functions with explicit grants.
- Deleted Sets and instruments are kept in `recycle_bin` for 30 days.
- Recommended: turn on two-factor authentication for the platform owner account.

## Tests

`npm test` runs Vitest (unit tests for the core logic, the store, the cloud layer and every edge function). Layout
checks (no cut-off content, accessibility) were run with Playwright and axe-core against the built app.
