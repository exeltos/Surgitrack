import {getRuntimeDataMode} from '../../config/dataMode';
import {managedHospitalId} from './accessRequests';

const ACTIVE_ORGANIZATION_KEY = 'surgitrack-active-organization';

/**
 * The platform admin enters a hospital (or leaves to Studio only, with no id). A different
 * hospital means different data, so the page reloads and the workspace gate loads that hospital.
 */
export const switchHospital = (organizationId: string, hash = organizationId ? '#/hospital' : '#/studio') => {
  if (organizationId) sessionStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
  else sessionStorage.removeItem(ACTIVE_ORGANIZATION_KEY);
  sessionStorage.removeItem('surgitrack-session-user');
  sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
  window.location.hash = hash;
  window.location.reload();
};

export const activeHospitalId = () => sessionStorage.getItem(ACTIVE_ORGANIZATION_KEY) || '';

/** An admin working inside a hospital (a real one, or Demo) lands on its overview, not Studio. */
export const hospitalOverviewAvailable = () => getRuntimeDataMode() === 'DEMO' || !!managedHospitalId();
