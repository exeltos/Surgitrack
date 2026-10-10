# SurgiTrack: product and technical specification

A specification for building a comparable application: a multi-hospital web app for tracing surgical
instruments and instrument Sets through the hospital's Central Sterile Services Department (CSSD) cycle.
It describes what the current SurgiTrack does and why. It is written to be given to a developer or an AI
coding assistant as the brief; section 12 lists the order to build in and the acceptance checks.

Language of the product: Greek first, English second. UI texts below are given as they appear in Greek,
with the English in brackets where useful.

---

## 1. Purpose and scope

Hospitals must be able to answer, for any surgical instrument or Set: where is it now, who handled it, when
was it last sterilized and released, in which sterilizer load, and which patient it was used on. SurgiTrack
replaces paper logs with barcode scanning at every hand-over.

In scope:

- Registry of Sets (Σετ) and single instruments (εργαλεία), each with a unique barcode.
- The CSSD cycle: dispatch from a department → receipt → washing → check and composition → packaging →
  sterilizer load → release → storage → delivery back to the department.
- Chain of custody (who handed over, who received, when), patient code per use, surgical counts.
- Issues (missing, damaged, lost instruments), replacements from stock, purchase orders.
- Sterile expiry, usage limits for limited-use instruments, recalls of failed loads.
- Reports, traceability search, exports (Excel, CSV, PDF/print).
- Hospital administration: users, departments, roles and permissions, libraries, workflow settings.
- Multi-tenant platform: one platform owner, many hospitals, Demo hospitals for prospects, trials.

Out of scope: patient names (only a patient code is ever stored), billing, inventory valuation beyond a cost
field, integration with hospital EHR systems.

## 2. Users and roles

| Role                     | Code                                            | Scope                       | Can do                                                                                                                           |
| ------------------------ | ----------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Platform owner           | `ADMIN` with no hospital, `is_platform_admin()` | All hospitals               | Creates hospitals and their first admin, Demo hospitals, plans/trials; can enter any hospital ("view as")                        |
| Hospital admin           | `ADMIN`                                         | One hospital, no department | Users, departments, signup links, Studio (libraries, workflow, role permissions, settings), every screen                         |
| Sterilization supervisor | `STERILIZATION` + `supervisor = true`           | One hospital                | Everything a Sterilization user does, plus create/edit/delete Sets and instruments, composition, Service, bulk import, overview  |
| Sterilization user       | `STERILIZATION`                                 | One hospital                | Receipt, washing, check & composition, packaging, sterilizer loads, release, delivery, issues                                    |
| Department user          | `DEPARTMENT`                                    | One department              | Their department's Sets and instruments: dispatch to CSSD, receive, surgical count, report problems, history of their department |
| Viewer                   | `VIEWER`                                        | One hospital, read-only     | Overview, registries, issues, history, reports, traceability of the whole hospital; changes nothing (enforced by the database)   |

Permissions are named keys (e.g. `asset.create`, `sterilization.receive`, `traceability.view`). Each role has a
default set; the hospital admin can tune non-protected permissions per role in Studio → Δικαιώματα. Some
permissions are protected (always on for a role) and some are unavailable to a role (never grantable), so
the chain of custody cannot be broken by configuration. The database enforces the same rules (row level
security and guard triggers), not only the UI.

## 3. Accounts and access

- Invite-only. Nobody signs up without a hospital.
- Two ways in: (a) the admin invites by email with a role and department; (b) the admin shares a signup link
  (valid 10 days, revocable); the person fills name, department and password; after confirming their email the
  request goes to the admin, who approves (choosing role and department) or rejects. Each decision emails the
  person.
- Every user gets a personal username (e.g. `GN1234`: initials + 4 digits) and can sign in with it or email.
- Sign-in is rate limited per username and per IP (atomic reservation in the database).
- Screen lock after configurable idle time (default 15 min) for shared tablets; unlock with own password or
  switch user.
- Signing out first saves pending changes, then asks; if something still cannot be saved, it says how many
  changes would be lost, with «Παραμονή» (Stay) as the default.
- No MFA (decision of the product owner).

## 4. Domain model

All business tables carry `organization_id` (the hospital) and are isolated per hospital by row level
security. Ids of business records are text (generated on the client, so records can be created offline).

### 4.1 Assets

- **Set** (`instrument_sets`): barcode `S` + 6 digits, code, name, department, specialty, manufacturer,
  category, state, `expected` / `actual` instrument count, composition template (what it should contain:
  code, name, quantity), photos, color tapes, ownership (hospital / doctor / other + owner name), uses and
  `max_uses`, patient code of the last use, notes.
- **Instrument** (`instruments`): barcode `T` + 6 digits, code, name, department, specialty, manufacturer,
  `mode` = `SET_MEMBER` (belongs to `set_id`) | `STANDALONE` (belongs to a department) | `STOCK` (spare),
  state, uses, `max_uses` (limited-use instruments), sterilizations count, serial number, purchase date,
  warranty, cost, photos, color mode (`SET` = takes the Set's tape, `OWN`, `NONE`), ownership, retirement.
- Barcodes are unique per hospital; a reissued barcode keeps the old ones in `legacy_barcodes` so old labels
  still scan. When two offline devices hand out the same barcode, the second record gets the next free one and
  the user is told to reprint the label.

Asset states (`AssetState`):

```
IN_DEPARTMENT → PENDING_STERILIZATION → IN_WASHING → IN_PREPARATION → IN_PACKAGING
  → IN_STERILIZATION → AWAITING_RELEASE → IN_STORAGE → READY_FOR_PICKUP → IN_DEPARTMENT
side states: IN_STOCK, SERVICE, LOST, RETIRED (out of use, kept for reports)
```

Sterile states (count towards sterile expiry): `IN_STORAGE`, `READY_FOR_PICKUP`, `IN_DEPARTMENT`.

### 4.2 Process records (append-only evidence)

| Table                    | One row per                         | Key fields                                                                                                                                                         |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `movements`              | Every change of place or state      | asset, kind, from, to, status text, at, by, patient code, note; `created_by` set by the database                                                                   |
| `receipts`               | Receipt at CSSD                     | delivered by (user, department), received by, visible deviation, department mismatch, expected/actual, item checks, Set checks (container, composition, visual)    |
| `preparations`           | Check & composition                 | checked tools, all OK, process checks (clean & dry, function, assembly)                                                                                            |
| `workflow_checkpoints`   | Optional stage checks               | stage id, checks                                                                                                                                                   |
| `process_loads`          | Washer or sterilizer load           | kind, equipment, cycle number, program, items, chemical / biological indicator, status `OPEN → PASSED/FAILED → AWAITING_RELEASE → RELEASED / REPROCESS / RECALLED` |
| `sterilization_cycles`   | Item in a completed cycle           | result PASSED/FAILED, indicator                                                                                                                                    |
| `sterilization_releases` | Release decision per item           | physical parameters, chemical indicator, packaging integrity, BI result `NOT_REQUIRED/PASS/PENDING/FAIL`, decision `RELEASED/REPROCESS`                            |
| `deliveries`             | Hand-over back to a department      | delivered by / received by                                                                                                                                         |
| `surgical_counts`        | Count after surgery                 | Set, patient code, expected, counted, result, signed                                                                                                               |
| `recall_cases`           | Recall of a released load           | load, reason, items with status `OUTSTANDING/RETURNED/REPROCESSING/CLOSED`                                                                                         |
| `issues`                 | Problem                             | asset, type (missing, damaged, lost, service…), status, note, photos                                                                                               |
| `purchase_orders`        | Order for missing instruments       | lines, supplier, status, received barcodes                                                                                                                         |
| `recycle_bin`            | Deleted Set/instrument/library item | payload to restore, 30 days                                                                                                                                        |
| `deleted_records`        | Tombstones for sync                 | collection, id                                                                                                                                                     |
| `configuration_audit`    | Settings history                    | append-only, copied server-side                                                                                                                                    |

### 4.3 Hospital and platform

`organizations` (plan `STANDARD/TRIAL`, trial end, demo flags), `departments`, `profiles` (role, department,
supervisor, username), `hospital_settings` (one JSON document per hospital: libraries, color tapes, workflow,
role permissions, system settings), `signup_links`, `staff_access_requests`, `user_invitations`,
`devices` / `device_readings` / `device_keys` (connected sterilizers and washers), `asset_imports`,
`demo_*` tables, `platform_settings`, `login_attempts`.

## 5. The CSSD workflow

Eight stages; three are locked (cannot be switched off): Receipt, Sterilization, Delivery. The hospital can
switch the others off in Studio → Ροή Αποστείρωσης, and choose policies (count Sets at receipt, controlled
receipt from another department, chemical indicator required, biological indicator policy, release while BI
pending). Every change of the workflow creates a new version; records keep the version they were made under.

1. **Dispatch (department).** Scan the Set, enter the patient code if it was used, «Αποστολή προς
   Αποστείρωση». Limited-use instruments lose one use per dispatch after use; at zero they retire.
2. **Receipt (CSSD).** Identify the person handing over (personal code or signature), scan items, record any
   visible deviation (must be recorded against the Set or a specific instrument before confirming), optional
   full count. Missing instruments create an issue.
3. **Washing.** Start / finish cleaning; washer loads optional.
4. **Check & composition.** Tick each instrument against the composition template; missing or damaged ones
   are replaced from Stock or accepted as a recorded shortage (creates an issue); process checks.
5. **Packaging & labelling.** Choose sterile expiry (2, 3 or 6 months; hospital default in Settings); print the
   label.
6. **Sterilizer load.** Put Sets/instruments into a load: sterilizer, cycle number, program, indicators. Start,
   then complete with PASSED/FAILED. A connected sterilizer can fill the cycle data automatically.
7. **Release.** Per load: physical parameters, chemical indicator, packaging integrity, BI result. Release or
   send back to reprocess. A BI that later fails recalls the whole load: a recall case lists every item, where it
   is now and which patient it reached.
8. **Storage and delivery.** Released items wait in storage / ready for pickup; delivery records the person who
   receives them in the department.

Everything is done by scanning a barcode into a focused field (keyboard-wedge scanners, Enter opens at once);
typing works the same.

## 6. Screens

Left menu shows only what the role allows. Top bar: hospital/role, global barcode scan, language EL/EN,
Help Center, accessibility (text size, contrast), notifications, sign out.

| Screen                               | Route                                            | Main content                                                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview                             | `/overview`                                      | KPI tiles (each a link to the filtered list), per-department table, sterilization flow, items needing attention, latest movements, 14-day chart                                                                           |
| Department                           | `/department`                                    | The department's Sets and instruments, dispatch, receipt, surgical count, problem report                                                                                                                                  |
| Sterilization                        | `/sterilization`                                 | Tabs per stage with counts; work panel; receipt, check, packaging, load, release, delivery dialogs                                                                                                                        |
| Expiry                               | `/expiry`                                        | Sterile items by days left; expired ones to reprocess                                                                                                                                                                     |
| Devices                              | `/devices`                                       | Connected sterilizers/washers, readings, API key / file import / serial                                                                                                                                                   |
| Instruments, Sets, Standalone, Stock | `/tools`, `/sets`, `/standalone-tools`, `/stock` | Registries with search, filters, KPI strip, download; row opens the card                                                                                                                                                  |
| Card                                 | `/sets/:id`, `/tools/:id`                        | Details (editable), composition, history, issues, summary, notes, photos; actions (send to CSSD, print label/composition/count form, manage, report problem); previous/next arrows over the list it was opened from       |
| New Set / instrument                 | `/sets/new`, `/tools/new`                        | Details, composition from stock, photos, notes; barcode assigned on save                                                                                                                                                  |
| Bulk import                          | `/import`                                        | Excel/CSV wizard: file → column mapping → check → import; undo a whole import                                                                                                                                             |
| Name check                           | `/tools/names`                                   | Unify spelling of instrument names per code                                                                                                                                                                               |
| Issues & Replacements                | `/issues`, `/replacements`                       | Open problems; replacements from stock; purchase orders                                                                                                                                                                   |
| Reports                              | `/reports`                                       | Set composition, by department, by specialty, service & faults, usage limits, out of use, sterilizer loads, sterile expiry, patient traceability                                                                          |
| Traceability                         | `/traceability`                                  | Search by barcode or patient code → timeline; open card; download/print                                                                                                                                                   |
| History                              | `/movements`                                     | Immutable chain of custody, filters, last 90 days with "load older"                                                                                                                                                       |
| Users & Departments                  | `/hospital`                                      | Users list, pending requests, invitations, signup link, departments                                                                                                                                                       |
| Studio                               | `/studio`                                        | Libraries (specialties, manufacturers, suppliers, categories, sterilizers, color tapes), workflow, roles guide, permissions, settings (usage warning, default sterile duration, idle lock, barcode formats, label layout) |
| Recycle bin                          | `/bin`                                           | Deleted items for 30 days, restore or delete for good                                                                                                                                                                     |
| Hospitals                            | `/hospitals`                                     | Platform owner only                                                                                                                                                                                                       |

UX rules the current product follows (keep them):

- Every destructive or important action asks in an in-app dialog with a title, a button that says what will
  happen («Διαγραφή», «Ανάκληση φορτίου») and the safe choice pre-selected; never the browser's own popups.
- Leaving a page with unsaved changes asks first («Παραμονή» default); closing the tab triggers the browser
  prompt.
- Management actions can be undone from their notice for a few seconds; the undo is recorded too.
- Lists keep the whole name visible (wrap to two lines) rather than truncating; on phones tables become cards
  with labelled fields.
- Each list remembers its order and filters for previous/next on the card (Alt+←/→).
- Exports from any list: Excel, CSV (cells starting with `= + - @` are neutralised), PDF/print.
- Desktop first, but every screen must work at 390 px wide with no horizontal page scroll.

## 7. Business rules

- One location and state per asset at any time; every change writes a movement.
- A Set's instruments follow the Set. A Set member can be replaced only from Stock (same code), sent to
  Service, declared lost or retired; each produces movements and, where relevant, an issue.
- Usage limit: warning at the configured remaining uses (default 3); retire at zero.
- Sterile expiry from release date; notice in the last month (10 days for 2-month duration).
- A failed BI or a recall blocks the load's items from use and lists the patients reached.
- Released only on acceptable checks: a release that says RELEASED needs acceptable cycle parameters, intact
  packaging and no failed BI, and a Set or standalone instrument becomes ready (storage or pickup) from a
  sterilization stage only with an unused release of a passed cycle of it. Both are enforced by the database.
- Viewers write nothing; department users see only their department; supervisor-only actions are enforced by
  the database.
- Settings changes are audited (who, when, what) in an append-only table.
- Patient data: code only, no names, ever.

## 8. Architecture of the current implementation

- **Frontend:** React 18, TypeScript (strict), Vite, React Router (hash routing), plain CSS with a color token
  palette (`tokens.css`), lucide icons. Single page app hosted on Netlify (`www.surgitrack.eu`).
- **Backend:** Supabase: PostgreSQL 17 with row level security on every table, Auth, Realtime, Edge
  Functions (Deno) for: code login, invitations, staff signup and access requests, staff update/delete,
  hospital deletion, Demo accounts and their lifecycle (scheduled), device key and device ingest, hand-over
  verification.
- **State and sync:** the client keeps the hospital's data in a store mirrored to the tables
  (`useAppRecordSync`): writes are queued, sent in batches, retried with back-off (5 s to 2 min), a refused
  batch is bisected; Sets and instruments are saved after the cycles and releases waiting on the same device,
  so a release reaches the server before the Set it makes ready; permanent refusals restore the server version
  and tell the user; concurrent edits merge
  per field, same-field conflicts keep the first save and notify. Realtime pushes others' changes; without it,
  polling every 20 s. An IndexedDB copy opens the app instantly and survives reloads (unsaved changes kept and
  replayed; copy wiped at sign-out, ignored after a day).
- **Security definer functions** are catalogued in `supabase/SECURITY_DEFINER.md` and pinned by a test.
- **i18n:** Greek text is the key; `tr('Ελληνικό κείμενο')` looks up English in a lazily loaded dictionary;
  data labels go through a glossary.
- **Printing:** labels (barcode, 3 sizes), composition list, count form, load release form; HTML print
  templates with escaped content.

## 9. Non-functional requirements

- Multi-tenant isolation enforced in the database; anonymous visitors can call nothing but the signup link
  lookup.
- Works offline for a shift: changes queue locally and save when the network returns.
- Accessibility: WCAG 2 A/AA, checked with axe on every screen (0 serious findings).
- Every screen usable on desktop, tablet and phone.
- Performance: instant open from the local copy; large lists render progressively.
- Backups: nightly data dump restored onto a database rebuilt from the migrations, row counts compared,
  encrypted, kept 14 days.

## 10. Quality gates (CI)

Format (Prettier), typecheck, lint, unused CSS check, English completeness check, unit tests (Vitest, ~670),
build, database tests (all migrations replayed on PostgreSQL, ~108 SQL assertions on grants, tenants, roles,
audit, security definer functions), accessibility (axe on every route for two roles, desktop and phone).

## 11. Content and help

An in-app Help Center with a section per screen (summary, audience, chapters, step by step, checks, tip) and a
glossary, in both languages; the PDF manual is generated from it with screenshots (`npm run manual`).

## 12. Building it: order and acceptance

1. Tenancy, auth (invite-only, username login, rate limit), roles and permissions in the database.
2. Asset registry (Sets, instruments, stock), barcodes, cards, printing labels.
3. Movements and the department dispatch → CSSD receipt → delivery loop.
4. Full CSSD workflow with loads, indicators, release, recall; workflow settings and versions.
5. Issues, replacements, purchase orders, recycle bin.
6. Reports, traceability, history, exports.
7. Offline-first sync with conflict handling.
8. Studio, users & departments, signup links and approvals.
9. Platform owner, Demo hospitals, trials.
10. Help Center, manual, accessibility and the CI gates above.

Acceptance, at minimum:

- A Set can be traced end to end: dispatch with patient code → receipt → check with one missing instrument
  replaced from stock → load PASSED → release → delivery, and the traceability search by the patient code
  shows every step with user and time.
- A failed BI recalls the load and lists where each item is and which patient it reached.
- A Viewer cannot change anything, even by calling the API directly; a department user cannot read another
  department's records; hospital A cannot read hospital B.
- Disconnect the network, record a receipt, reload the page, reconnect: the receipt is saved once.
- Every screen passes axe with no serious findings at 1440 px and 390 px.
