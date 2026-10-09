import {supabase} from '../../lib/supabase';
import {APP_VERSION} from '../../config/appMeta';
import {getRuntimeDataMode} from '../../config/dataMode';
import {isChunkLoadError} from '../../core/resilience';
import {onSyncNotice} from './useAppRecordSync';

/**
 * Errors users meet go to `client_errors`, which only the platform owner reads (Studio → Σφάλματα). Only
 * the message, where it happened and the app version: never record contents. The same error is sent once
 * per 10 minutes and a tab sends at most 20, so a loop cannot flood the table.
 */
export type ErrorKind = 'error' | 'rejection' | 'render' | 'sync';

let organizationId: string | undefined;
let sent = 0;
const lastSent = new Map<string, number>();
const MAX_PER_TAB = 20;
const SAME_ERROR_MS = 10 * 60_000;

/** Set by the cloud workspace once it knows the hospital it works on. */
export const setErrorReportingOrganization = (id: string | undefined) => {
  organizationId = id;
};

const text = (value: unknown, max: number) => {
  const s = value instanceof Error ? value.message || value.name : typeof value === 'string' ? value : String(value);
  return s.trim().slice(0, max);
};

/**
 * Noise that says nothing about the app: browser quirks, extensions, a page file replaced by a release, and
 * a lost network (the app works offline and saves later, so that is not an error).
 */
export const ignoredError = (message: string, error?: unknown, source?: string) =>
  !message ||
  /ResizeObserver loop|Script error\.?$|^Load failed$|NetworkError when attempting|^Failed to fetch$/i.test(message) ||
  /^(chrome|moz|safari)-extension:/.test(source || '') ||
  (error !== undefined && isChunkLoadError(error));

export function reportError(kind: ErrorKind, error: unknown, detail?: string) {
  if (getRuntimeDataMode() !== 'PRODUCTION') return;
  const message = text(error, 500);
  if (ignoredError(message, error)) return;
  const route = window.location.hash.replace(/^#/, '').split('?')[0].slice(0, 200) || '/';
  const key = `${kind}|${message}|${route}`;
  const now = Date.now();
  if (sent >= MAX_PER_TAB || now - (lastSent.get(key) ?? 0) < SAME_ERROR_MS) return;
  lastSent.set(key, now);
  sent += 1;
  const stack = detail ?? (error instanceof Error ? error.stack : undefined);
  void supabase
    .from('client_errors')
    .insert({
      organization_id: organizationId ?? null,
      kind,
      message,
      detail: stack ? stack.slice(0, 4000) : null,
      route,
      app_version: APP_VERSION,
      user_agent: navigator.userAgent.slice(0, 300),
    })
    .then(
      () => undefined,
      () => undefined,
    );
}

/** Listens for uncaught errors, rejected promises and changes the server refused. Call once. */
export function installErrorReporting() {
  window.addEventListener('error', event => {
    if (ignoredError(event.message, event.error, event.filename)) return;
    reportError('error', event.error ?? event.message);
  });
  window.addEventListener('unhandledrejection', event => reportError('rejection', event.reason));
  onSyncNotice(notice => {
    if (notice.kind !== 'refused') return;
    for (const record of notice.records) reportError('sync', `${record.reason}: ${record.label}`);
  });
}
