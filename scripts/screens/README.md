# Screenshot harness

Captures every route of the app, for every role that can open it, at desktop (1440x900) and mobile (390x844)
size. The app runs fully signed in with no network access: Supabase is mocked inside the browser.

```sh
node scripts/screens/capture.mjs [--lang el|en] [--role ADMIN,STERILIZATION,SUPERVISOR,DEPARTMENT,VIEWER,PLATFORM|all]
     [--viewport desktop|mobile|both] [--out dir] [--only route] [--rebuild] [--no-extras]
     [--settle ms] [--max-height px]
```

- `--only /sets` keeps routes equal to or containing that text (`--only modal`, `--only signin` work too).
- `--rebuild` rebuilds the app. Without it, the build cached in `node_modules/.cache/surgitrack-screens/dist`
  is reused. Rebuild after changing `src/`.
- `--out` defaults to `node_modules/.cache/surgitrack-screens/out` (ignored by git). Files are named `<lang>_<role>_<viewport>_<page>.png`, for example
  `el_admin_desktop_sets.png`. `index.json` lists each file with its route, role, viewport, page state
  (spinner, error boundary, redirect, horizontal overflow) and the console errors and failed requests
  seen on that page.
- Chromium comes from `PLAYWRIGHT_BROWSERS_PATH`. Set `CHROMIUM_PATH` to use another binary.

## How it works

1. **Build**: `vite build` with `VITE_SUPABASE_URL=https://oklyqnoqzbhjudqbkulq.supabase.co` and
   `VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_placeholder`. The build is served by a small static
   server on 127.0.0.1.
2. **Data** (`seed-entry.ts`, bundled with esbuild at run time): the app's own Demo sample hospital
   (`src/data/demo.ts` through the demo repositories, with dates moved to today). It is turned into table
   rows with the app's `tableToRow`, so the real load path (`loadAppRecords`, then `tableFromRow`) reads
   them. The same file works out which routes each role may open, using `permissionsForRole` and the
   seeded role settings.
3. **Session**: an init script writes a fake session to `localStorage['sb-oklyqnoqzbhjudqbkulq-auth-token']`
   (valid for a year, so it is never refreshed). It also sets the language and turns on reduced motion.
4. **Mock Supabase** (`mock-supabase.mjs`, through `context.route`):
   - `/auth/v1/user`, `/auth/v1/token` and `/auth/v1/logout` are answered.
   - PostgREST `/rest/v1/<table>` runs against an in-memory database. It supports `eq`, `neq`, `gt`,
     `gte`, `lt`, `lte`, `in`, `is`, `like`, `ilike`, `not.`, `or=(…)`, `order`, `offset`/`limit`,
     `count=exact` (Content-Range), single-row and maybe-single reads, and upsert/insert/update/delete.
   - `/rest/v1/rpc/*` and `/functions/v1/*` get canned answers, including the `staff-signup` link info
     for the join page.
   - The Realtime websocket is answered with `routeWebSocket`: joins are acknowledged with the
     client's own bindings.
   - Every other off-machine request is aborted and listed as `blockedRequests`.
5. **Accounts**: each role is a profile in the same hospital, _Γενικό Νοσοκομείο Δοκιμών_.
   `SUPERVISOR` is a Sterilization supervisor. `PLATFORM` is `info@exeltos.com`: the platform owner, with
   no hospital picked, who works in Studio. Signed-out screens are captured too: sign-in, and the join
   page at `/join/<token>`.
6. **Capture**: the harness loads the app and saves `home-firstload`, then reloads once (see the known
   issue below). For each route it sets `location.hash`, waits until no spinner shows and the network is
   idle, then takes the screenshot. The app scrolls inside panels, not on the page, so the window is
   made taller until no panel scrolls (up to `--max-height`, default 4000px). Long lists are cut at that
   height. Lists that load more rows as you scroll show a "more rows" spinner at the cut, which is
   expected.
7. **Modals** (bonus): Sterilization receipt, bulk receipt, and issue resolve, where the role has them.

## Harness artifacts (not app bugs)

- Chromium reports a routed `HEAD` request (the pending-signups count) as `ERR_ABORTED`, even though the
  page gets the answer. These are filtered out of the logs.
- The data is the Demo sample. Names such as "Demo Χρήστης Αποστείρωσης" in History come from the sample
  movements' `by` field.

## Fixed: identity on the first load

The harness used to show a supervisor on the first load of a tab as the built-in "Demo Χρήστης
Αποστείρωσης", without the supervisor-only permissions: `App.restoreSession` only called
`setRole('STERILIZATION')`, the store's default role, so the store never re-rendered. The store now keeps
the signed-in user in state (`setSessionUser`), and outside Demo it never falls back to a stand-in
identity. `*_supervisor_*_home-firstload.png` should show the real user.

## Column alignment

`alignment-probe.js` lists, per screen, the column titles that line up with their column neither on the left
nor on the right (tables, and grid lists with a `*-head` row):

```sh
SCREENS_EVAL="$(cat scripts/screens/alignment-probe.js)" node scripts/screens/capture.mjs --viewport desktop --no-extras
```

Each screen's findings are in `index.json` as `state.probe`.
