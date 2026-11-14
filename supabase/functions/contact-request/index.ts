import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import {createClient} from "jsr:@supabase/supabase-js@2";
import {clientIp, corsFor, jsonWith} from "../_shared/http.ts";
import {esc, layout, sendEmail} from "../_shared/mail.ts";

// «Ζητήστε παρουσίαση» on the public first page (no sign-in): a visitor's name, hospital, role, email, phone and
// message. It is stored in contact_requests (the platform owner sees it in Studio → Αιτήματα παρουσίασης) and
// emailed to the company's public address (Studio → Ρυθμίσεις). A hidden field that people leave empty catches
// most bots; one address may send 3 requests an hour and the whole form 30, so it cannot be used to flood the
// inbox. The address is kept only as a salted SHA-256.
const corsBase = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const PER_ADDRESS_PER_HOUR = 3;
export const PER_HOUR = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const text = (value: unknown, max: number) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
};

Deno.serve(async req => {
  const cors = corsFor(req, corsBase);
  const json = jsonWith(cors);
  if (req.method === "OPTIONS") return new Response("ok", {headers: cors});
  if (req.method !== "POST") return json({error: "method_not_allowed"}, 405);
  try {
    const body = await req.json().catch(() => ({}));
    // The hidden field: a person never fills it in. A bot that does is told it worked, and nothing is kept.
    if (text(body?.website, 200)) return json({ok: true});

    const request = {
      name: text(body?.name, 120),
      organization: text(body?.organization, 160) || null,
      role: text(body?.role, 120) || null,
      email: text(body?.email, 200).toLowerCase(),
      phone: text(body?.phone, 40) || null,
      // The message keeps its line breaks.
      message: String(body?.message ?? "").trim().slice(0, 3000),
    };
    if (request.name.length < 2 || !EMAIL.test(request.email) || request.message.length < 5)
      return json({error: "invalid"}, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, {auth: {persistSession: false}});
    const ipHash = await sha256(`contact:${service.slice(-16)}:${clientIp(req)}`);
    // The limits and the insert in one locked step in the database: simultaneous requests cannot all slip past.
    const {data: outcome, error: submitError} = await admin.rpc("submit_contact_request", {
      p_name: request.name,
      p_organization: request.organization,
      p_role: request.role,
      p_email: request.email,
      p_phone: request.phone,
      p_message: request.message,
      p_ip_hash: ipHash,
      p_per_address: PER_ADDRESS_PER_HOUR,
      p_per_hour: PER_HOUR,
    });
    if (submitError) {
      console.error("contact-request", submitError.message);
      return json({error: "unavailable"}, 503);
    }
    if (outcome === "too_many") return json({error: "too_many"}, 429);
    if (outcome !== "ok") return json({error: "unavailable"}, 503);

    // To the company's public address, or else the trial contact's.
    const {data: settings} = await admin
      .from("platform_settings")
      .select("public_email, contact_email")
      .eq("id", true)
      .maybeSingle();
    const to = settings?.public_email || settings?.contact_email;
    const row = (label: string, value: string | null) =>
      value ? `<tr><td style="padding:4px 12px 4px 0;color:#738396">${label}</td><td style="padding:4px 0;color:#152c41"><b>${esc(value)}</b></td></tr>` : "";
    const html = layout(
      "ΑΙΤΗΜΑ ΠΑΡΟΥΣΙΑΣΗΣ",
      esc(request.organization || request.name),
      `<table role="presentation" cellspacing="0" cellpadding="0">${row("Όνομα", request.name)}${row("Νοσοκομείο", request.organization)}${row("Ρόλος", request.role)}${row("Email", request.email)}${row("Τηλέφωνο", request.phone)}</table>` +
        `<p style="margin:18px 0 0;white-space:pre-wrap;color:#1d2939">${esc(request.message)}</p>` +
        `<p style="margin:18px 0 0">Απαντήστε στο <a href="mailto:${esc(request.email)}">${esc(request.email)}</a>. Το αίτημα είναι και στο Studio → Αιτήματα παρουσίασης.</p>`,
    );
    const emailed = to
      ? await sendEmail([to], `SurgiTrack: αίτημα παρουσίασης από ${request.organization || request.name}`, html).catch(() => false)
      : false;
    return json({ok: true, emailed: !!emailed});
  } catch (e) {
    console.error("contact-request", e instanceof Error ? e.message : e);
    return json({error: "failed"}, 500);
  }
});
