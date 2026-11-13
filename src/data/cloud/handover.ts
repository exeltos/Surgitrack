import {supabase} from '../../lib/supabase';
import {getRuntimeDataMode} from '../../config/dataMode';
import {getRealIdentity, productionOrganizationFor} from './identity';

/**
 * The other party of a handover, confirmed with their own user code and password. `signatureId` names the
 * server's record of that signature, for the items on screen when it was given: each receipt or delivery of
 * that handover cites it, and the server verifies it once per item (absent in Demo).
 */
export type HandoverSigner = {
  code: string;
  userId: string;
  name: string;
  department: string;
  role: string;
  signatureId?: string;
};

/** Demo only: the department people of the demo hospital. Any password is accepted. */
export const DEMO_HANDOVER_PEOPLE: HandoverSigner[] = [
  ['OR2187', 'Χειρουργείου', 'Χειρουργείο'],
  ['TK1042', 'Αίθουσας Τοκετών', 'Αίθουσα Τοκετών'],
  ['IV1130', 'IVF', 'Μονάδα IVF'],
  ['OK1210', 'Ορθοπεδικής', 'Ορθοπεδική Κλινική'],
  ['GK1320', 'Γυναικολογικής', 'Γυναικολογική Κλινική'],
  ['MT1440', 'ΜΕΘ', 'ΜΕΘ'],
  ['TP1550', 'ΤΕΠ', 'ΤΕΠ'],
].map(([code, of, department]) => ({
  code,
  userId: `demo-${code.toLowerCase()}`,
  name: `Demo Χρήστης ${of}`,
  department,
  role: 'Χρήστης Τμήματος',
}));

/** Demo only: the Sterilization person who brings sterile Sets to a department and signs there. */
export const DEMO_HANDOVER_STERILIZATION: HandoverSigner = {
  code: 'ST1001',
  userId: 'demo-st1001',
  name: 'Demo Χρήστης Αποστείρωσης',
  department: 'Κεντρική Αποστείρωση',
  role: 'Αποστείρωση',
};

export const isDemoHandover = () => getRuntimeDataMode() === 'DEMO' || !getRealIdentity();

/**
 * A handover signed by one of the Demo's sample people: confirmed (true), as the app checked their code.
 * Undefined otherwise, for the database to stamp from the server signature (handover_counterparty_stamp).
 */
export const demoSigned = (otherPartyId?: string, signatureId?: string) =>
  isDemoHandover() &&
  !signatureId &&
  !!otherPartyId &&
  [...DEMO_HANDOVER_PEOPLE, DEMO_HANDOVER_STERILIZATION].some(p => p.userId === otherPartyId)
    ? true
    : undefined;

export type HandoverVerifyResult =
  | {ok: true; signer: HandoverSigner}
  | {ok: false; reason: 'invalid' | 'invalid_pass' | 'locked' | 'same_user' | 'unavailable'};

/** Confirms the other party for the handover of these items (Set and instrument ids). */
export async function verifyHandover(
  userCode: string,
  password: string,
  assetIds: string[] = [],
): Promise<HandoverVerifyResult> {
  const code = userCode.trim().toUpperCase();
  if (!code || !password) return {ok: false, reason: 'invalid'};
  if (isDemoHandover()) {
    const signer = [...DEMO_HANDOVER_PEOPLE, DEMO_HANDOVER_STERILIZATION].find(person => person.code === code);
    return signer ? {ok: true, signer} : {ok: false, reason: 'invalid'};
  }
  const real = getRealIdentity();
  const {data, error} = await supabase.functions.invoke<{
    signature_id?: string;
    user_id: string;
    name: string;
    user_code: string;
    role: string;
    department: string;
  }>('verify-handover', {
    body: {
      user_code: code,
      password,
      asset_ids: assetIds,
      organization_id: real ? productionOrganizationFor(real) : undefined,
    },
  });
  if (error || !data) {
    const status = (error as {context?: {status?: number}} | null)?.context?.status;
    if (status === 429) return {ok: false, reason: 'locked'};
    if (status === 409) return {ok: false, reason: 'same_user'};
    if (status === 401) return {ok: false, reason: 'invalid'};
    return {ok: false, reason: 'unavailable'};
  }
  return {
    ok: true,
    signer: {
      code: data.user_code,
      userId: data.user_id,
      name: data.name,
      department: data.department,
      role: data.role,
      signatureId: data.signature_id,
    },
  };
}

/** What the QR of a person's phone holds: this prefix, then a one-time pass (or, in the Demo, their code). */
export const HANDOVER_PASS_PREFIX = 'SURGITRACK-PASS:';

/** The pass inside a scanned QR, or null when the scan is something else (a Set's barcode). */
export const passFromScan = (scanned: string): string | null => {
  const text = scanned.trim();
  return text.toUpperCase().startsWith(HANDOVER_PASS_PREFIX) ? text.slice(HANDOVER_PASS_PREFIX.length).trim() : null;
};

/**
 * A new one-time pass for the signed-in person's QR (it lives 45 seconds). In the Demo a fixed pass naming the
 * Demo person of their department, which the Demo accepts as their signature.
 */
export async function requestHandoverPass(department: string): Promise<{pass: string; expiresAt: number} | null> {
  if (isDemoHandover()) {
    const person = DEMO_HANDOVER_PEOPLE.find(p => p.department === department) || DEMO_HANDOVER_PEOPLE[0];
    return {pass: `DEMO:${person.code}`, expiresAt: Date.now() + 45_000};
  }
  const {data, error} = await supabase.functions.invoke<{pass: string; expires_at: string}>('handover-pass', {
    body: {},
  });
  if (error || !data?.pass) return null;
  return {pass: data.pass, expiresAt: new Date(data.expires_at).getTime()};
}

/** Confirms the other party from the QR they showed, for the handover of these items. */
export async function verifyHandoverPass(pass: string, assetIds: string[] = []): Promise<HandoverVerifyResult> {
  if (!pass) return {ok: false, reason: 'invalid'};
  if (isDemoHandover()) {
    const code = pass.startsWith('DEMO:') ? pass.slice(5) : '';
    const signer = [...DEMO_HANDOVER_PEOPLE, DEMO_HANDOVER_STERILIZATION].find(person => person.code === code);
    return signer ? {ok: true, signer} : {ok: false, reason: 'invalid'};
  }
  const real = getRealIdentity();
  const {data, error} = await supabase.functions.invoke<{
    signature_id?: string;
    user_id: string;
    name: string;
    user_code: string;
    role: string;
    department: string;
  }>('verify-handover', {
    body: {pass, asset_ids: assetIds, organization_id: real ? productionOrganizationFor(real) : undefined},
  });
  if (error || !data) {
    const status = (error as {context?: {status?: number}} | null)?.context?.status;
    if (status === 409) return {ok: false, reason: 'same_user'};
    if (status === 401) return {ok: false, reason: 'invalid_pass'};
    return {ok: false, reason: 'unavailable'};
  }
  return {
    ok: true,
    signer: {
      code: data.user_code,
      userId: data.user_id,
      name: data.name,
      department: data.department,
      role: data.role,
      signatureId: data.signature_id,
    },
  };
}
