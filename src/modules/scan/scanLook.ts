import {createContext, type ReactNode} from 'react';

/** The station a screen belongs to: its icon and colour, shown in the screen's header. */
export const ScanStationLook = createContext<{icon?: ReactNode; tone?: string}>({});
