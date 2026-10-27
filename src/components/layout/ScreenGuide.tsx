import {BookOpen, Compass, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {helpManual} from '../../core/help/helpManual';
import type {Permission} from '../../core/permissions';
import {tr} from '../../i18n';

/** The manual section of a menu screen, if this person may open it. */
export const screenSection = (pathname: string, can: (p: Permission) => boolean) =>
  helpManual.find(s => !s.guide && !s.detailOf && s.to === pathname && (!s.permission || can(s.permission)));

/**
 * What the screen is for and its first steps, from the manual, above the screen (it does not block it). It opens
 * from «Οδηγός οθόνης» in the top bar, when the person asks for it, and closes again; nothing is remembered. For
 * departments, Sterilization and the hospital admin; a hospital can turn it off for everyone (Studio → Ρυθμίσεις →
 * Οδηγοί οθόνης).
 */
export default function ScreenGuide({
  pathname,
  lang,
  can,
  onHelp,
  onClose,
}: {
  pathname: string;
  lang: 'el' | 'en';
  can: (p: Permission) => boolean;
  onHelp: () => void;
  onClose: () => void;
}) {
  const section = screenSection(pathname, can);
  if (!section) return null;
  return (
    <aside className="screen-guide" aria-label={tr('Οδηγός οθόνης')}>
      <div className="screen-guide-icon">
        <Compass size={20} aria-hidden="true" />
      </div>
      <div className="screen-guide-body">
        <small>{tr('Οδηγός οθόνης')}</small>
        <h2>{section.title[lang]}</h2>
        <p>{section.summary[lang]}</p>
        <ol>
          {section.steps[lang].slice(0, 3).map(step => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <div className="screen-guide-actions">
          <AppButton size="sm" variant="primary" onClick={onClose}>
            {tr('Το κατάλαβα')}
          </AppButton>
          <AppButton
            size="sm"
            icon={<BookOpen size={14} />}
            onClick={() => {
              onClose();
              onHelp();
            }}
          >
            {tr('Αναλυτικά στη Βοήθεια')}
          </AppButton>
        </div>
      </div>
      <button type="button" className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
        <X size={16} />
      </button>
    </aside>
  );
}
