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
