import {recordKey} from './remoteChanges';
import type {CloudRecord} from './appRecords';

type Rec = CloudRecord & Record<string, unknown>;
const same = (a: unknown, b: unknown) => recordKey(a ?? null) === recordKey(b ?? null);

/**
 * Two devices changed the same record. `base` is what this device last had from the server, `local` its
 * unsaved version, `server` what the other device saved since. Every field changed only here goes on top
 * of the server's version, so both changes are kept; a field changed on both devices to different values
 * keeps the saved (server) value and is reported, so the user knows their change there did not stick.
 */
export function mergeConcurrent(base: CloudRecord | undefined, local: CloudRecord, server: CloudRecord) {
  const b = (base || {}) as Rec;
  const l = local as Rec;
  const s = server as Rec;
  const merged: Rec = {...s};
  const conflicts: string[] = [];
  for (const key of new Set([...Object.keys(l), ...Object.keys(s), ...Object.keys(b)])) {
    if (key === 'id') continue;
    if (same(l[key], b[key])) continue; // not changed here
    const changedThere = !same(s[key], b[key]);
    if (changedThere && !same(s[key], l[key])) {
      conflicts.push(key);
      continue;
    }
    if (l[key] === undefined) delete merged[key];
    else merged[key] = l[key];
  }
  return {merged: merged as CloudRecord, conflicts, keepsLocal: !same(merged, s)};
}

const FIELD_NAMES: Record<string, [string, string]> = {
  state: ['κατάσταση', 'state'],
  status: ['κατάσταση', 'status'],
  name: ['ονομασία', 'name'],
  department: ['τμήμα', 'department'],
  notes: ['σημειώσεις', 'notes'],
  note: ['σημείωση', 'note'],
  uses: ['χρήσεις', 'uses'],
  maxUses: ['όριο χρήσεων', 'usage limit'],
  actual: ['εργαλεία', 'instruments'],
  setId: ['Σετ', 'Set'],
  patientCode: ['κωδικός ασθενούς', 'patient code'],
  sterileUntil: ['λήξη', 'expiry'],
  photos: ['φωτογραφίες', 'photos'],
  compositionTemplate: ['σύνθεση', 'composition'],
};
/** A field's name for the user. */
export const fieldName = (key: string, lang: 'el' | 'en') => FIELD_NAMES[key]?.[lang === 'el' ? 0 : 1] || key;

/** How the user recognises a record: barcode and name, an issue's subject, or its id. */
export const recordLabel = (record: CloudRecord) => {
  const r = record as Rec;
  if (typeof r.barcode === 'string') return [r.barcode, r.name].filter(Boolean).join(' · ');
  if (typeof r.asset === 'string') return r.asset;
  return record.id;
};
