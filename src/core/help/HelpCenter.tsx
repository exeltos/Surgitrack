import '../../styles/help-center.css';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileDown,
  FileSpreadsheet,
  Flame,
  History,
  Hospital,
  IdCard,
  Info,
  Layers3,
  LayoutDashboard,
  LifeBuoy,
  Mail,
  Repeat,
  Rocket,
  ScanSearch,
  Scissors,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  SpellCheck,
  Trash2,
  TriangleAlert,
  Warehouse,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import {navigationGroupLabel, type NavigationGroup} from '../../config/navigation';
import {useSurgi} from '../../store/SurgiStore';
import {useAppPreferences} from '../AppPreferences';
import {APP_VERSION, SUPPORT_CONTACT} from '../../config/appMeta';
import {getRuntimeDataMode} from '../../config/dataMode';
import {loadPlatformContact, type PlatformContact} from '../../data/cloud/platformContact';
import {glossary, helpManual, type ManualSection} from './helpManual';
import ScreenPreview from './ScreenPreview';
import OwnerManuals from './OwnerManuals';
import {ReleaseHistory} from '../../components/layout/WhatsNew';
import {getRealIdentity} from '../../data/cloud/identity';

const ui = {
  el: {
    center: 'Κέντρο Βοήθειας & Πληροφοριών',
    guide: 'Οδηγός χρήσης SurgiTrack',
    search: 'Αναζήτηση στο εγχειρίδιο...',
    searchGlossary: 'Αναζήτηση ορολογίας...',
    roleGuide: 'Εγχειρίδιο προσαρμοσμένο στον ρόλο σας',
    sections: 'Ενότητες για τον ρόλο σας',
    glossary: 'Ορολογία',
    whatsNew: 'Τι νέο υπάρχει',
    about: 'Σχετικά / Έκδοση',
    version: 'Έκδοση',
    userGuide: 'Οδηγός χρήσης',
    currentScreen: 'Τρέχουσα οθόνη',
    forRole: 'Αφορά',
    howTo: 'Πώς το χρησιμοποιώ',
    beforeFinish: 'Έλεγχος πριν ολοκληρώσετε',
    goodPractice: 'Καλή πρακτική',
    previous: 'Προηγούμενη ενότητα',
    next: 'Επόμενη ενότητα',
    firstSteps: 'Πρώτα βήματα',
    related: 'Σχετικές ενότητες',
    openScreen: 'Άνοιγμα οθόνης',
    glossaryTitle: 'Όροι της εφαρμογής',
    glossaryBody: 'Οι όροι που χρησιμοποιούνται μέσα στο SurgiTrack.',
    aboutTitle: 'Σχετικά με την εφαρμογή',
    purposeBody:
      'Το SurgiTrack παρακολουθεί Σετ και χειρουργικά εργαλεία από το τμήμα έως την Κεντρική Αποστείρωση και πίσω, με πλήρη ιχνηλασιμότητα, όρια χρήσεων και αναφορές.',
    noResults: 'Δεν βρέθηκε ενότητα με αυτόν τον όρο.',
    close: 'Κλείσιμο Κέντρου Βοήθειας',
    support: 'Υποστήριξη',
    supportTitle: 'Χρειάζεστε βοήθεια;',
    supportBody:
      'Ξεκινήστε από το εγχειρίδιο: ανοίγει στη σελίδα της οθόνης που βλέπετε. Αν δεν λυθεί, απευθυνθείτε στο σωστό σημείο.',
    hospitalAdmin: 'Στο νοσοκομείο σας',
    hospitalAdminBody:
      'Λογαριασμός, όνομα χρήστη, κωδικός, ρόλος, τμήμα και δικαιώματα: ο διαχειριστής του νοσοκομείου σας.',
    technical: 'Τεχνική υποστήριξη',
    technicalBody: 'Σφάλμα της εφαρμογής, κάτι που δεν αποθηκεύεται, εισαγωγή δεδομένων, συσκευές ή συμβόλαιο:',
    writeEmail: 'Αποστολή email',
    include: 'Για γρηγορότερη απάντηση γράψτε',
    includeItems: [
      'το νοσοκομείο και το όνομα χρήστη σας',
      'την οθόνη και τι κάνατε, με ημερομηνία και ώρα',
      'το barcode του Σετ ή του εργαλείου, αν αφορά κάποιο',
      'το μήνυμα που εμφανίστηκε, ιδανικά με στιγμιότυπο οθόνης',
    ],
    mailSubject: 'SurgiTrack: αίτημα υποστήριξης',
  },
  en: {
    center: 'Help & Information Center',
    guide: 'SurgiTrack User Guide',
    search: 'Search the user guide...',
    searchGlossary: 'Search terminology...',
    roleGuide: 'User guide tailored to your role',
    sections: 'Sections available to your role',
    glossary: 'Glossary',
    whatsNew: "What's new",
    about: 'About / Version',
    version: 'Version',
    userGuide: 'User guide',
    currentScreen: 'Current screen',
    forRole: 'For',
    howTo: 'How to use it',
    beforeFinish: 'Check before you finish',
    goodPractice: 'Good practice',
    previous: 'Previous section',
    next: 'Next section',
    firstSteps: 'First steps',
    related: 'Related sections',
    openScreen: 'Open screen',
    glossaryTitle: 'Application terms',
    glossaryBody: 'Terms used throughout SurgiTrack.',
    aboutTitle: 'About the application',
    purposeBody:
      'SurgiTrack tracks Sets and surgical instruments from the department to Central Sterilization and back, with full traceability, usage limits and reports.',
    noResults: 'No section matches this search.',
    close: 'Close Help Center',
    support: 'Support',
    supportTitle: 'Need help?',
    supportBody:
      'Start with the user guide: it opens on the page of the screen you are on. If that does not solve it, contact the right place.',
    hospitalAdmin: 'At your hospital',
    hospitalAdminBody: "Account, username, password, role, department and permissions: your hospital's administrator.",
    technical: 'Technical support',
    technicalBody: 'An application error, something that does not save, data import, devices or your contract:',
    writeEmail: 'Send email',
    include: 'For a faster answer include',
    includeItems: [
      'your hospital and username',
      'the screen and what you did, with date and time',
      'the barcode of the Set or instrument, if one is involved',
      'the message shown, ideally with a screenshot',
    ],
    mailSubject: 'SurgiTrack: support request',
  },
};

type Mode = 'manual' | 'news' | 'glossary' | 'about' | 'support' | 'pdf';

/** The manual's sections in the groups of the app's own menu, each with the icon of its menu entry. */
const SECTION_GROUP: Record<string, NavigationGroup | 'START'> = {
  '/start': 'START',
  '/start-admin': 'START',
  '/asset-card': 'START',
  '/overview': 'WORK',
  '/department': 'WORK',
  '/sterilization': 'WORK',
  '/sterilizers': 'WORK',
  '/issues': 'WORK',
  '/replacements': 'WORK',
  '/expiry': 'WORK',
  '/sets': 'EQUIPMENT',
  '/tools': 'EQUIPMENT',
  '/standalone-tools': 'EQUIPMENT',
  '/stock': 'EQUIPMENT',
  '/tools/names': 'EQUIPMENT',
  '/traceability': 'INSIGHT',
  '/reports': 'INSIGHT',
  '/movements': 'INSIGHT',
  '/hospital': 'ADMIN',
  '/hospitals': 'ADMIN',
  '/studio': 'ADMIN',
  '/import': 'ADMIN',
  '/bin': 'ADMIN',
};
const GROUP_ORDER: Array<NavigationGroup | 'START'> = ['START', 'WORK', 'EQUIPMENT', 'INSIGHT', 'ADMIN'];
const SECTION_ICON: Record<string, LucideIcon> = {
  '/start': Rocket,
  '/start-admin': Building2,
  '/asset-card': IdCard,
  '/overview': LayoutDashboard,
  '/department': Layers3,
  '/sterilization': Sparkles,
  '/sterilizers': Flame,
  '/issues': TriangleAlert,
  '/replacements': Repeat,
  '/expiry': CalendarClock,
  '/sets': Layers3,
  '/tools': Wrench,
  '/standalone-tools': Scissors,
  '/stock': Warehouse,
  '/tools/names': SpellCheck,
  '/traceability': ScanSearch,
  '/reports': BarChart3,
  '/movements': History,
  '/hospital': Building2,
  '/hospitals': Hospital,
  '/studio': Settings2,
  '/import': FileSpreadsheet,
  '/bin': Trash2,
};
const groupOf = (to: string) => SECTION_GROUP[to] || 'ADMIN';
const sortByGroup = (sections: ManualSection[]) =>
  GROUP_ORDER.flatMap(group => sections.filter(s => groupOf(s.to) === group));

/** Pages from which Set and instrument cards open. */
const RECORD_LISTS = ['/department', '/tools', '/sets', '/standalone-tools', '/stock', '/sterilization'];

/**
 * The role-aware user manual, opened from the header; it starts on the section of the current screen.
 * `screens` are the pages the user can open from the menu now (the platform admin outside a
 * hospital has only a few); sections for other pages are left out. Detail sections, which open
 * from a record rather than the menu, only need their permission.
 */
export default function HelpCenter({onClose, screens}: {onClose: () => void; screens: string[]}) {
  const {pathname, search} = useLocation();
  const navigate = useNavigate();
  const {can} = useSurgi();
  const {lang} = useAppPreferences();
  const L = lang === 'en' ? 'en' : 'el';
  const tx = ui[L];
  const visible = useMemo(
    () =>
      sortByGroup(helpManual).filter(
        s =>
          (!s.permission || can(s.permission)) &&
          (s.detailOf
            ? screens.some(x => RECORD_LISTS.includes(x))
            : s.openedFrom
              ? s.openedFrom.some(x => screens.includes(x))
              : s.guide || screens.includes(s.to)),
      ),
    [can, screens],
  );
  const sectionFor = (path: string): ManualSection | undefined =>
    visible.find(s => !s.guide && path === s.to) ||
    visible.find(s => s.detailOf?.some(prefix => path.startsWith(prefix))) ||
    visible.find(s => path === s.to || path.startsWith(`${s.to}/`)) ||
    (path.startsWith('/standalone') ? visible.find(s => s.to === '/standalone-tools') : undefined);
  // Replacements is a tab of Issues: its own section opens from that tab.
  const screenSection =
    (pathname === '/issues' && new URLSearchParams(search).get('tab') === 'replacements'
      ? visible.find(s => s.to === '/replacements')
      : undefined) || sectionFor(pathname);
  const [selected, setSelected] = useState(() => (screenSection || visible[0])?.to || '');
  const [mode, setMode] = useState<Mode>('manual');
  // The PDF manuals are for the platform owner's own account only (not when viewing as a role, not in Demo).
  const owner = !!getRealIdentity()?.platform && getRuntimeDataMode() !== 'DEMO';
  const [query, setQuery] = useState('');
  // Who to contact: the platform's contact (Studio → Settings), else the default.
  const [contact, setContact] = useState<PlatformContact>(SUPPORT_CONTACT);
  useEffect(() => {
    if (getRuntimeDataMode() !== 'PRODUCTION') return;
    void loadPlatformContact().then(c => c.email && setContact(c));
  }, []);
  const searchRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const filtered = visible.filter(s =>
    `${s.title[L]} ${s.summary[L]} ${s.chapters.map(c => c[L].join(' ')).join(' ')} ${s.steps[L].join(' ')}`
      .toLowerCase()
      .includes(q),
  );
  const terms = glossary.filter(g => `${g.term} ${g.el} ${g.en}`.toLowerCase().includes(q));
  const current = visible.find(s => s.to === selected) || visible[0];
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
              <strong>SurgiTrack</strong>
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
            {/* On a phone the sections are one pick list (the sidebar list had room for a single entry). */}
            <select
              className="manual-mobile-pick"
              aria-label={tx.sections}
              value={mode === 'manual' ? `section:${selected}` : `mode:${mode}`}
              onChange={e => {
                const [kind, value] = e.target.value.split(/:(.*)/);
                if (kind === 'section') select(value);
                else setMode(value as Mode);
              }}
            >
              <optgroup label={tx.sections}>
                {filtered.map(s => (
                  <option key={s.to} value={`section:${s.to}`}>
                    {s.title[L]}
                  </option>
                ))}
              </optgroup>
              <option value="mode:news">{tx.whatsNew}</option>
              <option value="mode:glossary">{tx.glossary}</option>
              <option value="mode:support">{tx.support}</option>
              {owner && <option value="mode:pdf">{L === 'el' ? 'Εγχειρίδια PDF' : 'PDF manuals'}</option>}
              <option value="mode:about">{tx.about}</option>
            </select>
            <div className="manual-side-label">{tx.sections}</div>
            <nav className="manual-nav">
              {filtered.length ? (
                GROUP_ORDER.map(group => {
                  const inGroup = filtered.filter(s => groupOf(s.to) === group);
                  if (!inGroup.length) return null;
                  return (
                    <div className="manual-nav-group" key={group}>
                      <div className="manual-nav-group-label">
                        {group === 'START' ? tx.firstSteps : navigationGroupLabel[group][L === 'en' ? 1 : 0]}
                      </div>
                      {inGroup.map(s => {
                        const Icon = SECTION_ICON[s.to] || BookOpen;
                        return (
                          <button
                            key={s.to}
                            className={selected === s.to && mode === 'manual' ? 'active' : ''}
                            onClick={() => select(s.to)}
                          >
                            <Icon size={15} />
                            <span>{s.title[L]}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              ) : (
                <div className="manual-nav-empty">{tx.noResults}</div>
              )}
            </nav>
            <div className="manual-side-bottom">
              <button className={mode === 'news' ? 'active' : ''} onClick={() => setMode('news')}>
                <Sparkles size={15} />
                <span>{tx.whatsNew}</span>
              </button>
              <button className={mode === 'glossary' ? 'active' : ''} onClick={() => setMode('glossary')}>
                <BookOpen size={15} />
                <span>{tx.glossary}</span>
              </button>
              <button className={mode === 'support' ? 'active' : ''} onClick={() => setMode('support')}>
                <LifeBuoy size={15} />
                <span>{tx.support}</span>
              </button>
              {owner && (
                <button className={mode === 'pdf' ? 'active' : ''} onClick={() => setMode('pdf')}>
                  <FileDown size={15} />
                  <span>{L === 'el' ? 'Εγχειρίδια PDF' : 'PDF manuals'}</span>
                </button>
              )}
              <button className={mode === 'about' ? 'active' : ''} onClick={() => setMode('about')}>
                <Info size={15} />
                <span>{tx.about}</span>
              </button>
              <div className="manual-version">
                {tx.version} {APP_VERSION}
              </div>
            </div>
          </aside>

          {mode === 'manual' && current && (
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
              {!current.guide && (
                <ScreenPreview
                  key={current.to}
                  src={`${import.meta.env.BASE_URL}help/${current.to.replace(/^\//, '')}.jpg`}
                  title={current.title[L]}
                  lang={L}
                  onOpenChange={onPreviewChange}
                />
              )}
              {screenSection?.to !== current.to && !current.detailOf && !current.guide && (
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
              <article className="manual-copy">
                {/* Every chapter on one page: they are short, so no tabs and no «1 / 2» to click through. */}
                {current.chapters.map(c => (
                  <section className="manual-chapter" key={c[L][0]}>
                    <h2>{c[L][0]}</h2>
                    <p>{c[L][1]}</p>
                  </section>
                ))}
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
                {/* On to the section before or after, in the order of the list on the left. */}
                <footer className="manual-chapter-footer">
                  {(() => {
                    const at = visible.findIndex(s => s.to === current.to);
                    const prev = visible[at - 1];
                    const next = visible[at + 1];
                    return (
                      <>
                        <button disabled={!prev} onClick={() => prev && select(prev.to)}>
                          <ChevronLeft size={14} />
                          {prev ? prev.title[L] : tx.previous}
                        </button>
                        <button disabled={!next} onClick={() => next && select(next.to)}>
                          {next ? next.title[L] : tx.next}
                          <ChevronRight size={14} />
                        </button>
                      </>
                    );
                  })()}
                </footer>
              </article>
            </main>
          )}

          {mode === 'glossary' && (
            <main className="manual-special">
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

          {mode === 'support' && (
            <main className="manual-special">
              <h1>{tx.supportTitle}</h1>
              <p>{tx.supportBody}</p>
              <div className="manual-support-grid">
                <section>
                  <small>{tx.hospitalAdmin}</small>
                  <span>{tx.hospitalAdminBody}</span>
                </section>
                <section>
                  <small>{tx.technical}</small>
                  <span>{tx.technicalBody}</span>
                  <strong>
                    {contact.name ? `${contact.name} · ` : ''}
                    <a href={`mailto:${contact.email}`}>{contact.email}</a>
                    {contact.phone ? ` · ${contact.phone}` : ''}
                  </strong>
                  <a
                    className="manual-support-mail"
                    href={`mailto:${contact.email}?subject=${encodeURIComponent(`${tx.mailSubject} (v${APP_VERSION})`)}`}
                  >
                    <Mail size={15} />
                    {tx.writeEmail}
                  </a>
                </section>
              </div>
              <section className="manual-check-section">
                <h3>
                  <CheckCircle2 size={15} />
                  {tx.include}
                </h3>
                <ul>
                  {tx.includeItems.map(item => (
                    <li key={item}>
                      <CheckCircle2 size={14} />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </main>
          )}

          {mode === 'news' && (
            <main className="manual-special whats-new-help">
              <h1>{tx.whatsNew}</h1>
              <ReleaseHistory lang={L} can={can} />
            </main>
          )}

          {mode === 'pdf' && owner && <OwnerManuals lang={L} />}

          {mode === 'about' && (
            <main className="manual-special">
              <h1>{tx.aboutTitle}</h1>
              <p>{tx.purposeBody}</p>
              <div className="manual-about-grid">
                <section>
                  <small>{tx.version}</small>
                  <strong>{APP_VERSION}</strong>
                </section>
              </div>
            </main>
          )}
        </div>
      </section>
    </aside>
  );
}
