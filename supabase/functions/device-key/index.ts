import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

// Issues a new network key for a connected device (sterilizer, washer…). The key is returned once;
// only its SHA-256 is stored, and the previous key stops working. Only a hospital admin for a device
// of their own hospital, or the platform admin.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});
const hex = (bytes: ArrayBuffer | Uint8Array) =>
  Array.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async req => {
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
    const {data: me} = await admin.from("profiles").select("role, active, organization_id").eq("id", auth.user.id).maybeSingle();
    if (!me?.active || me.role !== "ADMIN") return json({error: "forbidden"}, 403);

    const body = await req.json().catch(() => ({}));
    const deviceId = String(body?.device_id || "");
    const {data: device} = await admin.from("devices").select("id, organization_id").eq("id", deviceId).maybeSingle();
    if (!device) return json({error: "not_found"}, 404);
    // A hospital admin only for their own hospital; the platform admin (no hospital) for any.
    if (me.organization_id && me.organization_id !== device.organization_id) return json({error: "forbidden"}, 403);

    const key = `stk_${hex(crypto.getRandomValues(new Uint8Array(24)))}`;
    const hash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
    const {error} = await admin.from("device_keys").upsert({device_id: device.id, key_hash: hash, created_at: new Date().toISOString()});
    if (error) return json({error: "failed", message: error.message}, 500);
    await admin.from("devices").update({key_hint: key.slice(-4), connection: "API"}).eq("id", device.id);
    return json({ok: true, key});
  } catch (e) {
    return json({error: "failed", message: e instanceof Error ? e.message : String(e)}, 500);
  }
});
