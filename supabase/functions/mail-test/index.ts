import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith} from "../_shared/http.ts";
import {appSite, esc, layout, mailConfigured, sendEmailResult} from "../_shared/mail.ts";

// The platform owner checks that the app's emails go out: one test message to their own address,
// and the answer says whether mail is set up, which way it went (SMTP or Resend) and why it failed.
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  if (req.method !== "POST") return json({error: "method_not_allowed"}, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || service;
    const admin = createClient(url, service, {auth: {persistSession: false}});
    const caller = createClient(url, anon, {
      auth: {persistSession: false},
      global: {headers: {Authorization: req.headers.get("Authorization") || ""}},
    });
    const {data: auth} = await caller.auth.getUser();
    if (!auth.user) return json({error: "unauthorized"}, 401);
    const {data: me} = await admin
      .from("profiles")
      .select("id, role, active, organization_id, email, name")
      .eq("id", auth.user.id)
      .maybeSingle();
    // The platform owner only: an admin with no hospital.
    if (!me?.active || me.role !== "ADMIN" || me.organization_id) return json({error: "forbidden"}, 403);
    const to = String(me.email || auth.user.email || "").trim();
    if (!to.includes("@")) return json({error: "no_email"}, 400);

    const body = await req.json().catch(() => ({}));
    const site = appSite(body?.origin);
    if (!mailConfigured()) return json({configured: false, ok: false, via: null, to, site});
    const sent = await sendEmailResult(
      [to],
      "SurgiTrack · Δοκιμαστικό email",
      layout(
        "ΔΟΚΙΜΗ",
        "Τα email του SurgiTrack φτάνουν",
        `<p>Αυτό είναι δοκιμαστικό μήνυμα για ${esc(String(me.name || to))}.</p>
         <p>Αν το βλέπετε, οι προσκλήσεις χρηστών, οι εγκρίσεις και οι ειδοποιήσεις φτάνουν κανονικά. Οι σύνδεσμοι των email οδηγούν στο <b>${esc(site)}</b>.</p>`,
        {href: site, label: "Άνοιγμα του SurgiTrack"},
      ),
    );
    return json({configured: true, ...sent, to, site});
  } catch (e) {
    return json({error: e instanceof Error ? e.message : "Request failed"}, 400);
  }
});
