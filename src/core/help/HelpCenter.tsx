import '../../styles/help-center.css';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Info, Search, ShieldCheck, Sparkles, X} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import {useAppPreferences} from '../AppPreferences';
import {APP_EDITION, APP_VERSION} from '../../config/appMeta';
import {glossary, helpManual, type ManualSection} from './helpManual';
import ScreenPreview from './ScreenPreview';

const ui = {
  el: {
    center: 'Κέντρο Βοήθειας & Πληροφοριών',
    guide: 'Οδηγός χρήσης SurgiTrack',
    search: 'Αναζήτηση στο εγχειρίδιο...',
    searchGlossary: 'Αναζήτηση ορολογίας...',
    roleGuide: 'Εγχειρίδιο προσαρμοσμένο στον ρόλο σας',
    sections: 'ΕΝΟΤΗΤΕΣ ΓΙΑ ΤΟΝ ΡΟΛΟ ΣΑΣ',
    glossary: 'Ορολογία',
    about: 'Σχετικά / Έκδοση',
    version: 'Έκδοση',
    userGuide: 'ΟΔΗΓΟΣ ΧΡΗΣΗΣ',
    currentScreen: 'ΤΡΕΧΟΥΣΑ ΟΘΟΝΗ',
    forRole: 'Αφορά',
    chapter: 'ΚΕΦΑΛΑΙΟ',
    howTo: 'Πώς το χρησιμοποιώ',
    beforeFinish: 'Έλεγχος πριν ολοκληρώσετε',
    goodPractice: 'Καλή πρακτική',
    roleAware: 'Προσαρμοσμένο στον λογαριασμό σας',
    roleAwareBody: 'Βλέπετε μόνο ενότητες στις οποίες ο ρόλος και τα δικαιώματά σας δίνουν πρόσβαση.',
    previous: 'Προηγούμενο',
    next: 'Επόμενο',
    related: 'Σχετικές ενότητες',
    openScreen: 'Άνοιγμα οθόνης',
    glossaryTitle: 'Όροι της εφαρμογής',
    glossaryBody: 'Οι όροι που χρησιμοποιούνται μέσα στο SurgiTrack.',
    aboutTitle: 'Σχετικά με την εφαρμογή',
    purposeBody:
      'Το SurgiTrack παρακολουθεί Σετ και χειρουργικά εργαλεία από το τμήμα έως την Κεντρική Αποστείρωση και πίσω, με πλήρη ιχνηλασιμότητα, όρια χρήσεων και αναφορές.',
    noResults: 'Δεν βρέθηκε ενότητα με αυτόν τον όρο.',
    close: 'Κλείσιμο Κέντρου Βοήθειας',
  },
  en: {
    center: 'Help & Information Center',
    guide: 'SurgiTrack User Guide',
    search: 'Search the user guide...',
    searchGlossary: 'Search terminology...',
    roleGuide: 'User guide tailored to your role',
    sections: 'SECTIONS AVAILABLE TO YOUR ROLE',
    glossary: 'Glossary',
    about: 'About / Version',
    version: 'Version',
    userGuide: 'USER GUIDE',
    currentScreen: 'CURRENT SCREEN',
    forRole: 'For',
    chapter: 'CHAPTER',
    howTo: 'How to use it',
    beforeFinish: 'Check before you finish',
    goodPractice: 'Good practice',
    roleAware: 'Tailored to your account',
    roleAwareBody: 'You see only the sections your role and permissions give you access to.',
    previous: 'Previous',
    next: 'Next',
    related: 'Related sections',
    openScreen: 'Open screen',
    glossaryTitle: 'Application terms',
    glossaryBody: 'Terms used throughout SurgiTrack.',
    aboutTitle: 'About the application',
    purposeBody:
      'SurgiTrack tracks Sets and surgical instruments from the department to Central Sterilization and back, with full traceability, usage limits and reports.',
    noResults: 'No section matches this search.',
    close: 'Close Help Center',
  },
};

type Mode = 'manual' | 'glossary' | 'about';

/** Pages from which Set and instrument cards open. */
const RECORD_LISTS = ['/department', '/tools', '/sets', '/standalone-tools', '/stock', '/sterilization'];

/** The role-aware user manual, opened from the header; it starts on the section of the current screen. */
/**
 * `screens` are the pages the user can open from the menu now (the platform admin outside a
 * hospital has only a few); sections for other pages are left out. Detail sections, which open
 * from a record rather than the menu, only need their permission.
 */
export default function HelpCenter({onClose, screens}: {onClose: () => void; screens: string[]}) {
  const {pathname} = useLocation();
  const navigate = useNavigate();
  const {can} = useSurgi();
  const {lang} = useAppPreferences();
  const L = lang === 'en' ? 'en' : 'el';
  const tx = ui[L];
  const visible = useMemo(
    () =>
      helpManual.filter(
        s =>
          (!s.permission || can(s.permission)) &&
          (s.detailOf ? screens.some(x => RECORD_LISTS.includes(x)) : screens.includes(s.to)),
      ),
    [can, screens],
  );
  const sectionFor = (path: string): ManualSection | undefined =>
    visible.find(s => s.detailOf?.some(prefix => path.startsWith(prefix))) ||
    visible.find(s => path === s.to || path.startsWith(`${s.to}/`)) ||
    (path.startsWith('/standalone') ? visible.find(s => s.to === '/standalone-tools') : undefined);
  const screenSection = sectionFor(pathname);
  const [selected, setSelected] = useState(() => (screenSection || visible[0])?.to || '');
  const [chapter, setChapter] = useState(0);
  const [mode, setMode] = useState<Mode>('manual');
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const filtered = visible.filter(s =>
    `${s.title[L]} ${s.summary[L]} ${s.chapters.map(c => c[L].join(' ')).join(' ')} ${s.steps[L].join(' ')}`
      .toLowerCase()
      .includes(q),
  );
  const terms = glossary.filter(g => `${g.term} ${g.el} ${g.en}`.toLowerCase().includes(q));
  const current = visible.find(s => s.to === selected) || visible[0];
  const currentChapter = current?.chapters[Math.min(chapter, current.chapters.length - 1)];
  const related = (current?.related || [])
    .map(to => visible.find(s => s.to === to))
    .filter((s): s is ManualSection => Boolean(s));

  const panelRef = useRef<HTMLElement>(null);
  // While the screen preview is open, Escape closes it rather than the whole manual.
  const previewOpen = useRef(false);
  const onPreviewChange = useCallback((open: boolean) => {
    previewOpen.current = open;
  }, []);
  // Focus moves into the manual while it is open and returns to the Help button when it closes.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    searchRef.current?.focus();
    return () => opener?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = [
          ...panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
          ),
        ];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape' && !previewOpen.current) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const select = (to: string) => {
    setMode('manual');
    setSelected(to);
    setChapter(0);
    setQuery('');
  };

  return (
    <aside className="help-panel-shell" role="dialog" aria-modal="true" aria-label={tx.center}>
      <div className="help-backdrop" onMouseDown={onClose} />
      <section className="manual-center" ref={panelRef}>
        <header className="manual-topbar">
          <div className="manual-brand">
            <span>S</span>
            <p>
              <strong>SURGITRACK</strong>
              <small>{tx.guide}</small>
            </p>
          </div>
          <label className="manual-search">
            <Search size={15} />
            <input
              ref={searchRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={mode === 'glossary' ? tx.searchGlossary : tx.search}
            />
            <kbd>Ctrl K</kbd>
          </label>
          <div className="manual-actions">
            <span>{tx.roleGuide}</span>
            <button className="manual-close" aria-label={tx.close} onClick={onClose}>
              <X size={19} />
            </button>
          </div>
        </header>

        <div className="manual-body">
          <aside className="manual-sidebar">
            <div className="manual-side-label">{tx.sections}</div>
            <nav className="manual-nav">
              {filtered.length ? (
                filtered.map(s => (
                  <button
                    key={s.to}
                    className={selected === s.to && mode === 'manual' ? 'active' : ''}
                    onClick={() => select(s.to)}
                  >
                    <BookOpen size={15} />
                    <span>{s.title[L]}</span>
                    <ChevronRight size={13} />
                  </button>
                ))
              ) : (
                <div className="manual-nav-empty">{tx.noResults}</div>
              )}
            </nav>
            <div className="manual-side-bottom">
              <button className={mode === 'glossary' ? 'active' : ''} onClick={() => setMode('glossary')}>
                <BookOpen size={15} />
                <span>{tx.glossary}</span>
              </button>
              <button className={mode === 'about' ? 'active' : ''} onClick={() => setMode('about')}>
                <Info size={15} />
                <span>{tx.about}</span>
              </button>
              <div className="manual-version">
                {tx.version} v{APP_VERSION}
                <span>{APP_EDITION}</span>
              </div>
            </div>
          </aside>

          {mode === 'manual' && current && currentChapter && (
            <main className="manual-article">
              <div className="manual-breadcrumb">
                {tx.userGuide}
                <ChevronRight size={12} />
                <span>{current.title[L]}</span>
                {screenSection?.to === current.to && <em>{tx.currentScreen}</em>}
              </div>
              <h1>{current.title[L]}</h1>
              <p className="manual-summary">{current.summary[L]}</p>
              <div className="manual-audience">
                <ShieldCheck size={15} />
                <span>
                  <b>{tx.forRole}:</b> {current.audience[L]}
                </span>
              </div>
              <ScreenPreview
                key={current.to}
                src={`${import.meta.env.BASE_URL}help/${current.to.replace(/^\//, '')}.jpg`}
                title={current.title[L]}
                lang={L}
                onOpenChange={onPreviewChange}
              />
              {screenSection?.to !== current.to && !current.detailOf && (
                <button
                  className="manual-open-screen"
                  onClick={() => {
                    navigate(current.to);
                    onClose();
                  }}
                >
                  {tx.openScreen}
                  <ChevronRight size={14} />
                </button>
              )}
              <div className="manual-chapter-tabs" role="tablist" aria-label={current.title[L]}>
                {current.chapters.map((c, i) => (
                  <button
                    key={c[L][0]}
                    role="tab"
                    aria-selected={chapter === i}
                    className={chapter === i ? 'active' : ''}
                    onClick={() => setChapter(i)}
                  >
                    <span>{i + 1}</span>
                    {c[L][0]}
                  </button>
                ))}
              </div>
              <article className="manual-copy">
                <span className="manual-step-label">
                  {tx.chapter} {chapter + 1} / {current.chapters.length}
                </span>
                <h2>{currentChapter[L][0]}</h2>
                <p>{currentChapter[L][1]}</p>
                <section className="manual-detail-section">
                  <h3>{tx.howTo}</h3>
                  <ol>
                    {current.steps[L].map((step, i) => (
                      <li key={step}>
                        <b>{i + 1}</b>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </section>
                {current.checks && (
                  <section className="manual-check-section">
                    <h3>
                      <CheckCircle2 size={15} />
                      {tx.beforeFinish}
                    </h3>
                    <ul>
                      {current.checks[L].map(item => (
                        <li key={item}>
                          <CheckCircle2 size={14} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                {current.tip && (
                  <div className="manual-good-practice">
                    <Sparkles size={16} />
                    <p>
                      <b>{tx.goodPractice}</b>
                      <span>{current.tip[L]}</span>
                    </p>
                  </div>
                )}
                <div className="manual-role-note">
                  <ShieldCheck size={17} />
                  <p>
                    <b>{tx.roleAware}</b>
                    <span>{tx.roleAwareBody}</span>
                  </p>
                </div>
                {related.length > 0 && (
                  <section className="manual-see-also" role="group" aria-label={tx.related}>
                    <b>{tx.related}</b>
                    <div>
                      {related.map(r => (
                        <button key={r.to} onClick={() => select(r.to)}>
                          <BookOpen size={14} />
                          {r.title[L]}
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <footer className="manual-chapter-footer">
                  <button disabled={chapter === 0} onClick={() => setChapter(i => Math.max(0, i - 1))}>
                    <ChevronLeft size={14} />
                    {tx.previous}
                  </button>
                  <span>
                    {chapter + 1} / {current.chapters.length}
                  </span>
                  <button
                    disabled={chapter === current.chapters.length - 1}
                    onClick={() => setChapter(i => Math.min(current.chapters.length - 1, i + 1))}
                  >
                    {tx.next}
                    <ChevronRight size={14} />
                  </button>
                </footer>
              </article>
            </main>
          )}

          {mode === 'glossary' && (
            <main className="manual-special">
              <span className="manual-step-label">{tx.glossary.toUpperCase()}</span>
              <h1>{tx.glossaryTitle}</h1>
              <p>{tx.glossaryBody}</p>
              <div className="manual-glossary">
                {terms.map(g => (
                  <div key={g.term}>
                    <b>{g.term}</b>
                    <span>{g[L]}</span>
                  </div>
                ))}
              </div>
            </main>
          )}

          {mode === 'about' && (
            <main className="manual-special">
              <span className="manual-step-label">SURGITRACK</span>
              <h1>{tx.aboutTitle}</h1>
              <p>{tx.purposeBody}</p>
              <div className="manual-about-grid">
                <section>
                  <small>{tx.version}</small>
                  <strong>v{APP_VERSION}</strong>
                  <span>{APP_EDITION}</span>
                </section>
              </div>
            </main>
          )}
        </div>
      </section>
    </aside>
  );
}
