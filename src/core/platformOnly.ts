import {getRuntimeDataMode} from '../config/dataMode';
import {getRealIdentity} from '../data/cloud/identity';

/**
 * The platform owner outside any hospital (real data, no hospital entered): the menu lists the Studio's
 * sections, so the Studio page shows one section at a time without its own tabs.
 */
export const isPlatformOnly = () =>
  getRuntimeDataMode() !== 'DEMO' &&
  !!getRealIdentity()?.platform &&
  !sessionStorage.getItem('surgitrack-active-organization');

/** The platform owner (or local development, signed in as no one), inside a hospital or not. */
export const isPlatformOwner = () => {
  const real = getRealIdentity();
  if (!real) return true;
  if (!real.platform) return false;
  // The owner viewing the hospital as one of its roles («Διαχειριστής νοσοκομείου»…) sees exactly what that role
  // sees: none of the owner's parts.
  try {
    return !JSON.parse(sessionStorage.getItem('surgitrack-session-user') || 'null')?.viewAs;
  } catch {
    return true;
  }
};
