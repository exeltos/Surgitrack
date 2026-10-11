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
