import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith} from "../_shared/http.ts";

// A one-time pass for the signed-in person's QR: they show it on their phone at a handover and Sterilization
// scans it instead of asking for their username and password (verify-handover takes it, once). It lives
// 45 seconds; the phone asks for a new one every 30. Only its SHA-256 is stored. A person who may not sign a
// handover gets none: inactive, read-only viewers, and whoever still has the initial password.
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LIFETIME_SECONDS = 45;

// Capitals and digits only: scanners and the phone's camera read it alike (some turn letters to capitals),
// and a QR of capitals and digits is less dense, so it scans from further away.
const hex = (bytes: Uint8Array) => [...bytes].map(b => b.toString(16).padStart(2, "0")).join("").toUpperCase();
const sha256 = async (text: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
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
      .select("id, organization_id, role, active, password_change_required")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!me?.active || !me.organization_id || me.role === "VIEWER" || me.password_change_required) {
      return json({error: "forbidden"}, 403);
    }

    const token = hex(crypto.getRandomValues(new Uint8Array(20)));
    const expiresAt = new Date(Date.now() + LIFETIME_SECONDS * 1000).toISOString();
    // The person's earlier passes go: only the one on the screen now can be used.
    await admin.from("handover_passes").delete().eq("user_id", me.id).is("used_at", null);
    const {error} = await admin.from("handover_passes").insert({
      organization_id: me.organization_id,
      user_id: me.id,
      token_hash: await sha256(token),
      expires_at: expiresAt,
    });
    if (error) {
      console.error("handover-pass", error.message);
      return json({error: "failed"}, 500);
    }
    return json({pass: token, expires_at: expiresAt});
  } catch (e) {
    console.error("handover-pass", e instanceof Error ? e.message : e);
    return json({error: "failed"}, 500);
  }
});
