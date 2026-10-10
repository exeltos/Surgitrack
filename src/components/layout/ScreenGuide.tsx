import {useState} from 'react';
import {BookOpen, Compass, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {getRuntimeDataMode} from '../../config/dataMode';
import {helpManual} from '../../core/help/helpManual';
import type {Permission} from '../../core/permissions';
import {getRealIdentity} from '../../data/cloud/identity';
import {tr} from '../../i18n';

const key = (userId: string) => `surgitrack-screen-guides:${userId}`;
type Seen = {off?: boolean; screens: string[]};

const read = (userId: string): Seen => {
  try {
    const value = JSON.parse(localStorage.getItem(key(userId)) || 'null') as Seen | null;
    return value && Array.isArray(value.screens) ? value : {screens: []};
  } catch {
    return {screens: []};
  }
};
const write = (userId: string, seen: Seen) => {
  try {
    localStorage.setItem(key(userId), JSON.stringify(seen));
  } catch {
    // Private mode: shown again next time.
  }
};

/** The manual section of a menu screen, if this person may open it. */
export const screenSection = (pathname: string, can: (p: Permission) => boolean) =>
  helpManual.find(s => !s.guide && !s.detailOf && s.to === pathname && (!s.permission || can(s.permission)));

/**
 * The first time a person opens a screen: what it is for and its first steps, from the manual, above the
 * screen (it does not block it). Once closed it does not come back for that screen; it can be turned off
 * for every screen. Remembered per person, as ward devices are shared. A hospital can turn the guides off for
 * everyone (Studio → Ρυθμίσεις → Οδηγοί οθόνης): `enabled` false.
 */
export default function ScreenGuide({
  pathname,
  lang,
  can,
  onHelp,
  enabled = true,
}: {
  pathname: string;
  lang: 'el' | 'en';
  can: (p: Permission) => boolean;
  onHelp: () => void;
  enabled?: boolean;
}) {
  const userId = getRuntimeDataMode() === 'PRODUCTION' ? getRealIdentity()?.id : undefined;
  const [seen, setSeen] = useState<Seen>(() => (userId ? read(userId) : {off: true, screens: []}));
  const section = screenSection(pathname, can);
  if (!enabled || !userId || !section || seen.off || seen.screens.includes(section.to)) return null;
  const save = (next: Seen) => {
    setSeen(next);
    write(userId, next);
  };
  const done = () => save({...seen, screens: [...seen.screens, section.to]});
  return (
    <aside className="screen-guide" aria-label={tr('Οδηγός οθόνης')}>
      <div className="screen-guide-icon">
        <Compass size={20} aria-hidden="true" />
      </div>
      <div className="screen-guide-body">
        <small>{tr('Πρώτη φορά εδώ')}</small>
        <h2>{section.title[lang]}</h2>
        <p>{section.summary[lang]}</p>
        <ol>
          {section.steps[lang].slice(0, 3).map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="screen-guide-actions">
          <AppButton size="sm" variant="primary" onClick={done}>
            {tr('Το κατάλαβα')}
          </AppButton>
          <AppButton
            size="sm"
            icon={<BookOpen size={14} />}
            onClick={() => {
              done();
              onHelp();
            }}
          >
            {tr('Αναλυτικά στη Βοήθεια')}
          </AppButton>
          <button type="button" className="screen-guide-off" onClick={() => save({...seen, off: true})}>
            {tr('Να μην εμφανίζονται οδηγοί')}
          </button>
        </div>
      </div>
      <button type="button" className="icon-button" onClick={done} aria-label={tr('Κλείσιμο')}>
        <X size={16} />
      </button>
    </aside>
  );
}
