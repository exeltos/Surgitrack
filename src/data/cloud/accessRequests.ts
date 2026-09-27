import {supabase} from '../../lib/supabase';
import {getRuntimeDataMode} from '../../config/dataMode';
import {getRealIdentity, productionOrganizationFor} from './identity';

/**
 * The real hospital whose staff this signed-in admin manages: a hospital admin's own hospital,
 * or the one the platform admin picked in the header. Never a Demo hospital.
 */
export const managedHospitalId = (): string | undefined => {
  if (getRuntimeDataMode() === 'DEMO') return undefined;
  const real = getRealIdentity();
  if (!real || real.role !== 'ADMIN') return undefined;
  return productionOrganizationFor(real);
};

/** Signups that confirmed their email and wait for the hospital admin's decision. */
export const countPendingAccessRequests = async (organizationId: string) => {
  const {count, error} = await supabase
    .from('staff_access_requests')
    .select('id', {count: 'exact', head: true})
    .eq('organization_id', organizationId)
    .eq('status', 'PENDING');
  return error ? 0 : count || 0;
};

/** The shareable signup address for a link token (hash routing, like the rest of the app). */
export const signupUrl = (token: string) => `${window.location.origin}/#/join/${token}`;

/** Tells the header badge to recount after an approval or rejection. */
export const ACCESS_REQUESTS_CHANGED = 'surgitrack:access-requests-changed';
