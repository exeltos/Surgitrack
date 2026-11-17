import {createContext, useContext} from 'react';
import {type HospitalModule} from '../../core/hospitalModules';

/**
 * The modules the platform owner switched on for the open hospital. Null where nothing says otherwise (the
 * local sample hospital, a Demo, tests): every module is on.
 */
export const ModulesContext = createContext<readonly HospitalModule[] | null>(null);

/** Whether the open hospital has a module. */
export const useHasModule = (module: HospitalModule) => {
  const modules = useContext(ModulesContext);
  return modules === null || modules.includes(module);
};

/** Sent when the platform owner changes the open hospital's name, modules or use from its Settings. */
export const HOSPITAL_CHANGED = 'surgitrack-hospital-changed';
export type HospitalChange = {
  name: string;
  modules: HospitalModule[];
  plan: 'STANDARD' | 'TRIAL';
  trialEndsAt?: string;
};
export const announceHospitalChange = (change: HospitalChange) =>
  window.dispatchEvent(new CustomEvent<HospitalChange>(HOSPITAL_CHANGED, {detail: change}));
