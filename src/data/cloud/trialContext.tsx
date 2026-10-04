import {createContext, useContext} from 'react';
import type {TrialState} from '../../core/trial';

/** The open hospital's trial, for the strip under the top bar (null outside a cloud hospital). */
export const TrialContext = createContext<TrialState | null>(null);
export const useTrial = () => useContext(TrialContext);
