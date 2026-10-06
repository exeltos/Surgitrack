# Edge function tests

These run with the rest of the suite (`npm test`, and in CI), under Node, not Deno.

- `harness.ts` loads a function's `index.ts` and returns the handler it passes to `Deno.serve`, with a stand-in for `Deno.env`. Call it with a `Request` and read the `Response`.
- `vitest.config.ts` maps the Deno-style imports (`jsr:@supabase/supabase-js@2`, `npm:nodemailer`) to the stand-ins in `fakes/`.
- `fakes/nodemailer.ts` keeps each email in `mailState.outbox` (and can be made to fail), so a test can read what would have been sent. `fakes/supabase.ts` is a fake client. A test sets `fake.user` (who is signed in), `fake.db` (the answer to each table query), `fake.rpc`, `fake.signIn` and `fake.admin.*`, then checks `fake.calls` / `fake.dbCalls()` to see what the function did.

What is covered: the CORS and IP helpers, the sign-in rate limit, who may act in `delete-staff`, `staff-link` and `update-staff` (admin only, own hospital, never oneself), and `invite-staff` (who may invite, input checks, accounts made at once, signup invitations, approvals, emailed links and their escaping). What is not: `staff-signup`, `access-requests`, `device-key`, `verify-handover` and `device-ingest`; add a test file per function with the same harness.

A fake cannot show that the real Supabase answers as the test assumes, so a live smoke test after a deploy is still worth doing.
