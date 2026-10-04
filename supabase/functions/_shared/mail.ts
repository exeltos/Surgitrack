import {SMTPClient} from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// The app's own emails (signup invitations, approvals, admin alerts). They go out through the same
// SMTP server as the sign-in emails (secrets SMTP_HOST, SMTP_PORT, which is 465 since Edge Functions
// cannot use 25 or 587, SMTP_USER, SMTP_PASS, MAIL_FROM), or through Resend (RESEND_API_KEY,
// MAIL_FROM). Without either nothing is sent and the caller says so.

export const esc = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

const smtpSettings = () => {
  const host = Deno.env.get("SMTP_HOST");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("MAIL_FROM");
  return host && user && pass && from ? {host, user, pass, from, port: Number(Deno.env.get("SMTP_PORT") || 465)} : null;
};

/** Whether any way of sending email is set up. */
export const mailConfigured = () =>
  !!smtpSettings() || !!(Deno.env.get("RESEND_API_KEY") && Deno.env.get("MAIL_FROM"));

const sendSmtp = async (to: string[], subject: string, html: string) => {
  const s = smtpSettings();
  if (!s) return undefined;
  const client = new SMTPClient({
    connection: {hostname: s.host, port: s.port, tls: s.port === 465, auth: {username: s.user, password: s.pass}},
  });
  try {
    await client.send({from: s.from, to, subject, html, content: "auto"});
    return true;
  } catch (e) {
    console.error("smtp", e instanceof Error ? e.message : e);
    return false;
  } finally {
    // close() is not always a promise; a failure to close must not undo a sent email.
    try {
      await client.close();
    } catch {
      // ignore
    }
  }
};

const sendResend = async (to: string[], subject: string, html: string) => {
  const key = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MAIL_FROM");
  if (!key || !from) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {Authorization: `Bearer ${key}`, "Content-Type": "application/json"},
    body: JSON.stringify({from, to, subject, html}),
  });
  return res.ok;
};

export const sendEmail = async (to: string[], subject: string, html: string) => {
  if (!to.length) return false;
  return (await sendSmtp(to, subject, html)) ?? (await sendResend(to, subject, html));
};

/** The same look as the sign-in emails: a dark header, a white card, one button. */
export const layout = (eyebrow: string, title: string, body: string, button?: {href: string; label: string}) =>
  `<!doctype html><html lang="el"><body style="margin:0;background:#f4f7fa;font-family:Arial,sans-serif;color:#1d2939">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fa;padding:36px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e1e7ed;border-radius:16px;overflow:hidden">
<tr><td style="padding:24px 30px;background:#183b56;color:#fff"><div style="font-size:22px;font-weight:800">SurgiTrack</div><div style="font-size:11px;color:#c8d5de;margin-top:4px">Surgical Instrument Traceability</div></td></tr>
<tr><td style="padding:34px 30px"><div style="font-size:11px;font-weight:700;letter-spacing:.1em;color:#738396">${eyebrow}</div><h1 style="font-size:24px;margin:8px 0 12px;color:#152c41">${title}</h1>
<div style="font-size:14px;line-height:1.65;color:#667085">${body}</div>
${button ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:26px 0"><tr><td style="background:#183b56;border-radius:9px"><a href="${button.href}" style="display:inline-block;padding:13px 22px;color:#fff;text-decoration:none;font-size:14px;font-weight:700">${button.label}</a></td></tr></table>` : ""}
<div style="border-top:1px solid #edf1f4;margin-top:28px;padding-top:18px;font-size:11px;color:#98a2b3">SurgiTrack · Healthcare Suite<br>Αυτό είναι αυτοματοποιημένο μήνυμα. Για βοήθεια απευθυνθείτε στον διαχειριστή του νοσοκομείου σας.</div></td></tr></table>
</td></tr></table></body></html>`;

/** The username in a highlighted box. */
export const usernameBox = (code: string) =>
  `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:18px 0;background:#f4f7fa;border-radius:10px;width:100%"><tr><td style="padding:14px 16px">
<div style="font-size:11px;font-weight:700;letter-spacing:.08em;color:#738396">ΟΝΟΜΑ ΧΡΗΣΤΗ</div>
<div style="font-size:22px;font-weight:800;letter-spacing:2px;color:#152c41">${esc(code)}</div></td></tr></table>`;

export const SITE = "https://surgitrack-med.netlify.app";
// Links may point only at the app itself (production, its deploy previews, or local development).
const ALLOWED_ORIGIN = /^(https:\/\/([a-z0-9-]+--)?surgitrack-med\.netlify\.app|http:\/\/localhost:\d+)$/;
export const appSite = (origin: unknown) => {
  const o = String(origin || "").replace(/\/$/, "");
  return ALLOWED_ORIGIN.test(o) ? o : SITE;
};
