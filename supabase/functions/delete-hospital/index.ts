import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {corsFor, jsonWith} from "../_shared/http.ts";

// The platform owner deletes a hospital for good, from Studio: every record in it, its departments,
// its private Demo copies, and its people's accounts. The owner types the hospital's name to
// confirm, and the request carries it, so a stray call cannot delete the wrong hospital.
// Demo hospitals are not deleted here (evaluation Demos have their own "Delete Demo").
const corsBase = {"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"};

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  try {
    const url = Deno.env.get("SUPABASE_URL")!, anon = Deno.env.get("SUPABASE_ANON_KEY")!, service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const caller = createClient(url, anon, {global: {headers: {Authorization: req.headers.get("Authorization") || ""}}});
    const {data: {user}, error: ue} = await caller.auth.getUser();
    if (ue || !user) return json({error: "Unauthorized"}, 401);
    const admin = createClient(url, service);
    // The platform owner: an active admin who belongs to no hospital.
    const {data: cp} = await admin.from("profiles").select("role,active,organization_id").eq("id", user.id).maybeSingle();
    if (!cp?.active || cp.role !== "ADMIN" || cp.organization_id) return json({error: "Forbidden"}, 403);

    const body = await req.json();
    const {data: org} = await admin
      .from("organizations")
      .select("id, name, is_demo")
      .eq("id", String(body?.organization_id || ""))
      .maybeSingle();
    if (!org) return json({error: "Hospital not found"}, 404);
    if (org.is_demo) return json({error: "Not a hospital"}, 409);
    if (String(body?.confirm_name || "").trim() !== String(org.name).trim()) return json({error: "Name does not match"}, 400);

    // The hospital and its private Demo copies.
    const {data: copies, error: ce} = await admin.from("organizations").select("id").eq("demo_of", org.id);
    if (ce) throw ce;
    const ids = [org.id, ...((copies || []) as Array<{id: string}>).map(c => c.id)];
    // Invitations name who sent them, which would hold the sender's account back.
    const {error: ie} = await admin.from("user_invitations").delete().in("organization_id", ids);
    if (ie) throw ie;
    const {data: people, error: le} = await admin.from("profiles").select("id").in("organization_id", ids);
    if (le) throw le;
    for (const p of (people || []) as Array<{id: string}>) {
      if (p.id === user.id) continue;
      const {error} = await admin.auth.admin.deleteUser(p.id);
      if (error) throw error;
    }
    const {error: pe} = await admin.from("profiles").delete().in("organization_id", ids);
    if (pe) throw pe;
    // Its Demo copies go with it (demo_of cascades), and every record of each.
    const {error: oe} = await admin.from("organizations").delete().eq("id", org.id).eq("is_demo", false);
    if (oe) throw oe;
    return json({ok: true, accounts: (people || []).length});
  } catch (e) {
    const message = e instanceof Error ? e.message : String((e as {message?: string})?.message || "Request failed");
    return json({error: message}, 400);
  }
});
