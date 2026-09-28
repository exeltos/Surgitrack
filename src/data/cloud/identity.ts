import {supabase} from '../../lib/supabase';
import {getRuntimeDataMode} from '../../config/dataMode';
import type {SessionUser, UserRole} from '../../store/types';

export const PLATFORM_ADMIN_EMAIL = 'info@exeltos.com';

/** Who is actually signed in, independent of any role they are currently viewing the app as. */
export type RealIdentity = {
  id: string;
  name: string;
  role: UserRole;
  /** Platform admin: belongs to no hospital and may work in any of them. */
  platform: boolean;
  organizationId: string | null;
  departmentName: string;
  /** Sterilization supervisor, named by the hospital admin. */
  supervisor?: boolean;
};

/** A self-signup through a hospital link, before the hospital admin has approved it. */
export type AccessRequest = {
  id: string;
  status: 'PENDING_EMAIL' | 'PENDING' | 'APPROVED' | 'REJECTED';
  full_name: string;
  email: string;
  organization_name: string;
  department_name: string | null;
  decision_note: string | null;
  admin_notified: boolean;
};

/** The signed-in user's own access request, if they joined through a hospital signup link. */
export const loadMyAccessRequest = async (): Promise<AccessRequest | null> => {
  const {data, error} = await supabase.rpc('my_access_request');
  if (error) throw error;
  return (data as AccessRequest | null) || null;
};

export type IdentityResult =
  | {status: 'signed-out'}
  | {status: 'inactive'}
  | {status: 'pending'; request: AccessRequest}
  | {status: 'error'; message: string}
  | {status: 'ok'; identity: RealIdentity};

const REAL_USER_KEY = 'surgitrack-real-user';
const ACTIVE_ORGANIZATION_KEY = 'surgitrack-active-organization';

let pending: Promise<IdentityResult> | null = null;

/**
 * Resolves the signed-in user once per page load (the workspace gate and the app both need it).
 * The platform admin is recognised by email and claimed server-side; everyone else by profile.
 */
export const resolveIdentity = (): Promise<IdentityResult> => {
  pending ??= (async (): Promise<IdentityResult> => {
    const {data} = await supabase.auth.getSession();
    const authUser = data.session?.user;
    if (!authUser) return {status: 'signed-out'};
    let identity: RealIdentity;
    if (authUser.email?.toLowerCase() === PLATFORM_ADMIN_EMAIL) {
      const {error} = await supabase.rpc('claim_platform_admin');
      if (error) return {status: 'error', message: error.message};
      identity = {
        id: authUser.id,
        name: 'Platform Admin',
        role: 'ADMIN',
        platform: true,
        organizationId: null,
        departmentName: '',
      };
    } else {
      const {data: profile, error} = await supabase
        .from('profiles')
        .select('id,name,role,active,supervisor,organization_id,department:departments(name)')
        .eq('id', authUser.id)
        .maybeSingle();
      if (error) return {status: 'error', message: error.message};
      if (!profile) {
        // No profile yet: a signup waiting for the hospital admin's approval (or a rejected one).
        try {
          const request = await loadMyAccessRequest();
          if (request && request.status !== 'APPROVED') return {status: 'pending', request};
        } catch (e) {
          return {status: 'error', message: (e as {message?: string})?.message || String(e)};
        }
        return {status: 'inactive'};
      }
      if (!profile.active) return {status: 'inactive'};
      const department = profile.department as {name?: string} | {name?: string}[] | null;
      identity = {
        id: profile.id,
        name: profile.name,
        role: profile.role as UserRole,
        platform: false,
        organizationId: profile.organization_id,
        departmentName: (Array.isArray(department) ? department[0]?.name : department?.name) || '',
        supervisor: profile.role === 'STERILIZATION' && !!profile.supervisor,
      };
    }
    sessionStorage.setItem(REAL_USER_KEY, JSON.stringify(identity));
    return {status: 'ok', identity};
  })();
  return pending;
};

/** The signed-in identity resolved earlier in this tab, for synchronous UI decisions. */
export const getRealIdentity = (): RealIdentity | undefined => {
  try {
    return JSON.parse(sessionStorage.getItem(REAL_USER_KEY) || 'null') || undefined;
  } catch {
    return undefined;
  }
};

/**
 * The hospital whose data this tab works on. Hospital users always work in their own;
 * the platform admin works in the one picked in the header (or none, staying in Studio).
 */
export const productionOrganizationFor = (identity: RealIdentity): string | undefined => {
  if (!identity.platform) return identity.organizationId || undefined;
  return sessionStorage.getItem(ACTIVE_ORGANIZATION_KEY) || undefined;
};

/** The app identity of the signed-in user when not viewing as someone else. */
export const sessionUserFor = (identity: RealIdentity): SessionUser => ({
  id: identity.id,
  name: identity.name,
  role: identity.role,
  department: identity.platform ? 'Platform' : identity.departmentName,
  ...(identity.supervisor ? {supervisor: true} : {}),
});

/**
 * The platform owner working as the owner: not in Demo and not viewing a hospital as one of its
 * roles (including "Hospital administrator", which shows exactly what that admin sees).
 */
export const actingAsPlatformOwner = (): boolean => {
  const real = getRealIdentity();
  if (!real) return true; // local development without sign-in
  if (!real.platform || getRuntimeDataMode() === 'DEMO') return false;
  try {
    const user = JSON.parse(sessionStorage.getItem('surgitrack-session-user') || 'null') as SessionUser | null;
    return !user?.viewAs;
  } catch {
    return true;
  }
};

/** Admins can view (and act in) the app as another role or department of the hospital. */
export const canViewAs = (identity: RealIdentity | undefined) => identity?.role === 'ADMIN';

export const clearIdentity = () => {
  sessionStorage.removeItem(REAL_USER_KEY);
  pending = null;
};
