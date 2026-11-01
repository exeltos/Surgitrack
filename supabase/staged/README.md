# Staged database changes

Migrations here are written and tested but deliberately **not** in `supabase/migrations`, because applying them
before the app changes would break screens.

## `20261101100000_hide_profile_contacts.sql`

Closes the read of `profiles.email` and `profiles.user_code` by every member of a hospital (they make it possible to
try passwords directly at the sign-in service and to lock a colleague out of `login-with-code`).

Before applying it, the app must stop reading those two columns from the table. Places that do today:

| File                                                | What it needs                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| `src/modules/auth/AuthIndex.tsx` (`select(...)`)    | its own email: `profile_contacts()` returns the caller's own row             |
| `src/modules/hospital/people/usePeopleData.ts`      | the hospital's contacts: `profile_contacts(org)` (admin)                     |
| `src/modules/hospital/people/usePeopleMembers.ts`   | find a user by email (`ilike('email', …)`): look it up in `profile_contacts` |
| `src/modules/studio/hooks/useStudioCloud.ts`        | every hospital's users: `profile_contacts()` (platform owner)                |
| edge functions `update-staff`, `login-with-code`, … | run with the service role: not affected                                      |

To test it: `MIGRATIONS_DIR=<folder with the migrations and this file> bash supabase/tests/run-local.sh`, with
`staged/20261101100000_hide_profile_contacts_test.sql` run as a test. To apply it: move the file into
`supabase/migrations` in the same change as the app update.
