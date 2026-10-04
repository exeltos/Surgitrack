import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";

// Receives cycle data from a connected device (or the gateway / manufacturer software in front of
// it). The device signs in with its own key: header `x-device-key: stk_…` (or `Authorization:
// Bearer stk_…`). Body: one cycle, a list of cycles, or {"cycles": [...]}. Each cycle needs a cycle
// number; the rest is optional. A cycle already received (same device and number) is skipped.
//
//   {"cycle_number": "2026-0412", "program": "134°C 5 min", "started_at": "2026-10-04T08:12:00Z",
//    "ended_at": "2026-10-04T09:01:00Z", "result": "PASS", "max_temperature": 134.6,
//    "max_pressure": 3.1, "duration_minutes": 49}
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-device-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {status, headers: {...cors, "Content-Type": "application/json"}});
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
const MAX_CYCLES = 200;
const MAX_BODY = 512 * 1024;

type Raw = Record<string, unknown>;
const pick = (row: Raw, ...names: string[]) => {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
};
const text = (value: unknown) => (value === undefined ? null : String(value).trim().slice(0, 200));
const number = (value: unknown) => {
  if (value === undefined) return null;
  const n = Number(String(value).replace(",", ".").replace(/[^\d.+-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const time = (value: unknown) => {
  if (value === undefined) return null;
  const t = new Date(String(value));
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
};
const result = (value: unknown) => {
  if (value === true) return "PASS";
  if (value === false) return "FAIL";
  const v = String(value ?? "").trim().toUpperCase();
  if (["PASS", "OK", "PASSED", "SUCCESS", "GOOD", "ΕΠΙΤΥΧΙΑ", "1"].includes(v)) return "PASS";
  if (["FAIL", "FAILED", "ERROR", "ABORT", "ABORTED", "NOK", "ΑΠΟΤΥΧΙΑ", "0"].includes(v)) return "FAIL";
  return "UNKNOWN";
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  if (req.method !== "POST") return json({error: "method_not_allowed"}, 405);
  try {
    const bearer = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const key = (req.headers.get("x-device-key") || (bearer.startsWith("stk_") ? bearer : "")).trim();
    if (!/^stk_[0-9a-f]{48}$/.test(key)) return json({error: "device_key_required"}, 401);

    const raw = await req.text();
    if (raw.length > MAX_BODY) return json({error: "too_large"}, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({error: "invalid_json"}, 400);
    }
    const list = Array.isArray(body) ? body : Array.isArray((body as Raw)?.cycles) ? ((body as Raw).cycles as unknown[]) : [body];
    if (!list.length) return json({error: "no_cycles"}, 400);
    if (list.length > MAX_CYCLES) return json({error: "too_many_cycles", max: MAX_CYCLES}, 413);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, {auth: {persistSession: false}});
    const hash = hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key)));
    const {data: found} = await admin.from("device_keys").select("device_id").eq("key_hash", hash).maybeSingle();
    if (!found) return json({error: "unknown_device_key"}, 401);
    const {data: device} = await admin.from("devices").select("id, organization_id, active").eq("id", found.device_id).maybeSingle();
    if (!device?.active) return json({error: "device_inactive"}, 403);

    const rows = [];
    const rejected: number[] = [];
    list.forEach((item, index) => {
      const row = (item && typeof item === "object" ? item : {}) as Raw;
      const cycle = text(pick(row, "cycle_number", "cycleNumber", "cycle", "cycle_no", "batch", "load"));
      if (!cycle) return rejected.push(index);
      rows.push({
        organization_id: device.organization_id,
        device_id: device.id,
        cycle_number: cycle,
        program: text(pick(row, "program", "programme", "program_name")),
        started_at: time(pick(row, "started_at", "start", "startedAt", "start_time")),
        ended_at: time(pick(row, "ended_at", "end", "endedAt", "end_time")),
        result: result(pick(row, "result", "status", "outcome", "passed")),
        max_temperature: number(pick(row, "max_temperature", "maxTemperature", "temperature", "temp")),
        max_pressure: number(pick(row, "max_pressure", "maxPressure", "pressure")),
        duration_minutes: number(pick(row, "duration_minutes", "durationMinutes", "duration")),
        source: "API",
        raw: row,
      });
    });
    let stored = 0;
    if (rows.length) {
      const {data, error} = await admin
        .from("device_readings")
        .upsert(rows, {onConflict: "device_id,cycle_number", ignoreDuplicates: true})
        .select("id");
      if (error) return json({error: "failed", message: error.message}, 500);
      stored = data?.length || 0;
    }
    await admin.from("devices").update({last_seen_at: new Date().toISOString()}).eq("id", device.id);
    return json({ok: true, received: list.length, stored, skipped: rows.length - stored, rejected});
  } catch (e) {
    return json({error: "failed", message: e instanceof Error ? e.message : String(e)}, 500);
  }
});
