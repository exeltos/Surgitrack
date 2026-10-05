import {createClient} from '@supabase/supabase-js';

// No built-in fallback: a build without these settings must not quietly talk to a real project.
// See .env.example; production builds are also checked in vite.config.ts.
const configuredUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!configuredUrl || !supabasePublishableKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill them in.',
  );
}
export const supabaseUrl: string = configuredUrl.replace(/\/$/, '');

const RECOVERY_KEY = 'surgitrack-password-recovery';

/**
 * A password-reset (or invite) link signs the user in as soon as the client reads it, before the
 * app has rendered. Note it here, before the client consumes the link, so the app shows the
 * "new password" form instead of going straight in.
 */
export const markRecovery = () => {
  try {
    sessionStorage.setItem(RECOVERY_KEY, '1');
  } catch {
    // Storage blocked: the auth event below still reaches the login screen when it is mounted.
  }
};
if (typeof window !== 'undefined' && /type=(recovery|invite)/.test(window.location.hash + window.location.search))
  markRecovery();

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true},
});

// Links that carry no "type" in the URL (code exchange) announce themselves with this event.
supabase.auth.onAuthStateChange(event => {
  if (event === 'PASSWORD_RECOVERY') markRecovery();
});

/** Whether the user arrived through a password-reset link and has not set the new password yet. */
export const passwordRecoveryPending = () => {
  try {
    return sessionStorage.getItem(RECOVERY_KEY) === '1';
  } catch {
    return false;
  }
};
export const clearPasswordRecovery = () => {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
  } catch {
    // Nothing stored.
  }
};
