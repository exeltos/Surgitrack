import type {Organization} from '../../core/LibraryStore';
import {trialEndAfter, trialEndDate} from '../../core/trial';
import {ALL_MODULES, type HospitalModule} from '../../core/hospitalModules';

export type OrganizationForm = {
  name: string;
  code: string;
  plan: 'STANDARD' | 'TRIAL';
  /** The trial's last day (yyyy-mm-dd). */
  endDate: string;
  modules: HospitalModule[];
};

/** The form's values for a hospital, or a new one (no optional modules yet: the owner picks them). */
export const organizationForm = (organization?: Organization): OrganizationForm => ({
  name: organization?.name || '',
  code: organization?.code || '',
  plan: organization?.plan || 'STANDARD',
  endDate: trialEndDate(organization?.trialEndsAt) || trialEndDate(trialEndAfter(30)),
  modules: organization ? (organization.modules ?? ALL_MODULES) : [],
});
