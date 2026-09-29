import {supabase} from '../../lib/supabase';
import {getRuntimeDataMode} from '../../config/dataMode';
import {getRealIdentity, productionOrganizationFor} from './identity';

/** The other party of a handover, confirmed with their own user code and password. */
export type HandoverSigner = {code: string; userId: string; name: string; department: string; role: string};

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

export const isDemoHandover = () => getRuntimeDataMode() === 'DEMO' || !getRealIdentity();

export type HandoverVerifyResult =
  {ok: true; signer: HandoverSigner} | {ok: false; reason: 'invalid' | 'locked' | 'same_user' | 'unavailable'};

export async function verifyHandover(userCode: string, password: string): Promise<HandoverVerifyResult> {
  const code = userCode.trim().toUpperCase();
  if (!code || !password) return {ok: false, reason: 'invalid'};
  if (isDemoHandover()) {
    const signer = DEMO_HANDOVER_PEOPLE.find(person => person.code === code);
    return signer ? {ok: true, signer} : {ok: false, reason: 'invalid'};
  }
  const real = getRealIdentity();
  const {data, error} = await supabase.functions.invoke<{
    user_id: string;
    name: string;
    user_code: string;
    role: string;
    department: string;
  }>('verify-handover', {
    body: {user_code: code, password, organization_id: real ? productionOrganizationFor(real) : undefined},
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
    signer: {code: data.user_code, userId: data.user_id, name: data.name, department: data.department, role: data.role},
  };
}
