import {loadEnglish, setI18nLang} from '../i18n';
import {createContext, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
export type AppLang = 'el' | 'en';
type Prefs = {
  lang: AppLang;
  setLang: (v: AppLang) => void;
  fontScale: number;
  setFontScale: (v: number) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  reducedMotion: boolean;
  setReducedMotion: (v: boolean) => void;
};
const Ctx = createContext<Prefs | null>(null);
export function AppPreferencesProvider({children}: {children: ReactNode}) {
  const [lang, setLangState] = useState<AppLang>(() => {
    const initial = (localStorage.getItem('surgitrack-lang') as AppLang) || 'el';
    setI18nLang(initial);
    return initial;
  });
  const [fontScale, setFontScaleState] = useState(() => Number(localStorage.getItem('surgitrack-font-scale') || 1));
  const [highContrast, setHighContrastState] = useState(() => localStorage.getItem('surgitrack-contrast') === '1');
  const [reducedMotion, setReducedMotionState] = useState(() => localStorage.getItem('surgitrack-motion') === '1');
  const setLang = (v: AppLang) => {
    // The t() helper reads the language directly, so it must switch before the re-render;
    // English waits for its dictionary (and stays Greek if it cannot be downloaded).
    const apply = () => {
      setI18nLang(v);
      setLangState(v);
      localStorage.setItem('surgitrack-lang', v);
    };
    if (v === 'en') loadEnglish().then(apply, () => undefined);
    else apply();
  };
  const setFontScale = (v: number) => {
    setFontScaleState(v);
    localStorage.setItem('surgitrack-font-scale', String(v));
  };
  const setHighContrast = (v: boolean) => {
    setHighContrastState(v);
    localStorage.setItem('surgitrack-contrast', v ? '1' : '0');
  };
  const setReducedMotion = (v: boolean) => {
    setReducedMotionState(v);
    localStorage.setItem('surgitrack-motion', v ? '1' : '0');
  };
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.style.fontSize = `${fontScale * 100}%`;
    document.documentElement.dataset.contrast = highContrast ? 'high' : 'normal';
    document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'normal';
  }, [lang, fontScale, highContrast, reducedMotion]);
  const value = useMemo(
    () => ({lang, setLang, fontScale, setFontScale, highContrast, setHighContrast, reducedMotion, setReducedMotion}),
    [lang, fontScale, highContrast, reducedMotion],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const useAppPreferences = () => {
  const x = useContext(Ctx);
  if (!x) throw new Error('useAppPreferences outside provider');
  return x;
};
