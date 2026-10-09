# Edge function tests

These run with the rest of the suite (`npm test`, and in CI), under Node, not Deno.

- `harness.ts` loads a function's `index.ts` and returns the handler it passes to `Deno.serve`, with a stand-in for `Deno.env`. Call it with a `Request` and read the `Response`.
- `vitest.config.ts` maps the Deno-style imports (`jsr:@supabase/supabase-js@2`, `npm:nodemailer`) to the stand-ins in `fakes/`.
- `fakes/nodemailer.ts` keeps each email in `mailState.outbox` (and can be made to fail), so a test can read what would have been sent. `fakes/supabase.ts` is a fake client. A test sets `fake.user` (who is signed in), `fake.db` (the answer to each table query), `fake.rpc`, `fake.signIn` and `fake.admin.*`, then checks `fake.calls` / `fake.dbCalls()` to see what the function did.

What is covered: the CORS and IP helpers, the sign-in rate limit, who may act in `delete-staff`, `staff-link` and `update-staff` (admin only, own hospital, never oneself), `staff-signup` (the public form: link and invitation validity, input and password checks, throttling, the invited email kept, the inactive account and username made at signup), `access-requests` (cancel-invite), `device-key` (who may issue a key; the key is random, shown once, stored only as a SHA-256), `verify-handover` (who may ask, the other party's password check and its limit, what is returned and revoked), `device-ingest` (the device key, size and count limits, locked trials, how cycles are read and stored), and `invite-staff` (who may invite, input checks, accounts made at once, signup invitations by email or link, approvals that activate the account, rejections, emailed links and their escaping). Every edge function now has tests; add a test file for each new one with the same harness.

A fake cannot show that the real Supabase answers as the test assumes, so a live smoke test after a deploy is still worth doing.
