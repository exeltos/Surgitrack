import {useCallback} from 'react';
import {useLibraries} from '../../core/LibraryStore';
import {getI18nLang} from '../../i18n';
import type {CompositionOptions} from '../../modules/sterilization/printUtils';
import {useColorTapes} from './colorMarkerUtils';

/** The hospital's print look (label header, logo) plus a Set's color marker, for composition sheets. */
export function useCompositionOptions() {
  const {systemSettings} = useLibraries();
  const tapesById = useColorTapes();
  return useCallback(
    (colorTapes?: string[]): CompositionOptions => ({
      label: systemSettings.label,
      marker: (colorTapes || []).flatMap(id => {
        const tape = tapesById.get(id);
        return tape ? [{name: getI18nLang() === 'el' ? tape.el : tape.en, colors: tape.colors, label: tape.label}] : [];
      }),
    }),
    [systemSettings.label, tapesById],
  );
}
