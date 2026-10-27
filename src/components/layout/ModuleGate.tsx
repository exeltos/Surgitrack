import type {ReactNode} from 'react';
import {Navigate} from 'react-router-dom';
import type {HospitalModule} from '../../core/hospitalModules';
import {useHasModule} from '../../data/cloud/modulesContext';

/** A screen of a module the platform owner has not given this hospital: its address leads to the home instead. */
export default function ModuleGate({module, children}: {module: HospitalModule; children: ReactNode}) {
  const on = useHasModule(module);
  return on ? <>{children}</> : <Navigate to="/" replace />;
}
