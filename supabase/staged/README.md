# Staged database changes

Migrations here are written and tested but deliberately **not** in `supabase/migrations`, because applying them
before the app changes would break screens.

## `20261101100000_hide_profile_contacts.sql`

Closes the read of `profiles.email` and `profiles.user_code` by every member of a hospital (they make it possible to
try passwords directly at the sign-in service and to lock a colleague out of `login-with-code`).

The app no longer reads those two columns from the table (done on 01/11/2026, `src/data/cloud/profileContacts.ts`).
It reads them through `profile_contacts()`, and falls back to the table only while that function does not exist yet,
so the rollout order is:

1. Apply the four migrations of 01/11/2026 (the function is one of them).
2. Deploy this version of the app.
3. Move this file into `supabase/migrations` and apply it.

Screens that read them: Users & Departments (`usePeopleData`, `usePeopleMembers`), Studio users (`useStudioCloud`),
the Demo panel of the platform owner (`data/cloud/demoAccounts.ts`); the sign-in screen no longer asks for the email.
Edge functions run with the service role and are not affected.

To test it: `MIGRATIONS_DIR=<folder with the migrations and this file> bash supabase/tests/run-local.sh`, with
`staged/20261101100000_hide_profile_contacts_test.sql` run as a test. To apply it: move the file into
`supabase/migrations` in the same change as the app update.
