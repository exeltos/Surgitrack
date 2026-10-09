import {useEffect, useState} from 'react';
import {Check, Download, FileText, Link2, Share2} from 'lucide-react';
import AppButton from '../../components/ui/AppButton';

/** What scripts/manual/build.mjs writes next to the PDFs in public/manuals. */
type ManualFile = {file: string; pages: number; bytes: number; version: string; built: string};
type Manuals = Partial<Record<'el' | 'en', ManualFile>>;

const BASE = `${import.meta.env.BASE_URL ?? '/'}manuals/`;

const text = {
  el: {
    label: 'ΕΓΧΕΙΡΙΔΙΑ PDF',
    title: 'Εγχειρίδια χρήσης (PDF)',
    body: 'Ορατό μόνο σε εσάς ως owner της πλατφόρμας. Κατεβάστε τα ή στείλτε τα σε νοσοκομεία και συνεργάτες. Ο σύνδεσμος ανοίγει χωρίς σύνδεση, ώστε να τον λάβει όποιος τον χρειάζεται.',
    langs: {el: 'Ελληνικά', en: 'English'},
    pages: 'σελίδες',
    built: 'Δημιουργία',
    download: 'Λήψη',
    share: 'Αποστολή',
    copy: 'Αντιγραφή συνδέσμου',
    copied: 'Αντιγράφηκε',
    missing: 'Δεν βρέθηκαν τα εγχειρίδια σε αυτή την έκδοση.',
    rebuild: 'Τα εγχειρίδια ξαναφτιάχνονται με «npm run manual» μετά από αλλαγές στη Βοήθεια.',
    mailSubject: 'Εγχειρίδιο χρήσης SurgiTrack',
  },
  en: {
    label: 'PDF MANUALS',
    title: 'User manuals (PDF)',
    body: 'Visible only to you as the platform owner. Download them or send them to hospitals and partners. The link opens without signing in, so whoever needs it can get it.',
    langs: {el: 'Ελληνικά', en: 'English'},
    pages: 'pages',
    built: 'Built',
    download: 'Download',
    share: 'Send',
    copy: 'Copy link',
    copied: 'Copied',
    missing: 'The manuals were not found in this version.',
    rebuild: 'The manuals are rebuilt with "npm run manual" after changes to the Help.',
    mailSubject: 'SurgiTrack user manual',
  },
};

/** The PDF manuals for the platform owner: download, send (share sheet or email), copy the link. */
export default function OwnerManuals({lang}: {lang: 'el' | 'en'}) {
  const t = text[lang];
  const [manuals, setManuals] = useState<Manuals | null>(null);
  const [copied, setCopied] = useState('');
  useEffect(() => {
    let live = true;
    fetch(`${BASE}manuals.json`, {cache: 'no-cache'})
      .then(r => (r.ok ? (r.json() as Promise<Manuals>) : {}))
      .catch(() => ({}))
      .then(m => live && setManuals(m));
    return () => {
      live = false;
    };
  }, []);

  const url = (m: ManualFile) => new URL(`${BASE}${m.file}`, window.location.href).href;
  const send = async (m: ManualFile) => {
    const link = url(m);
    try {
      const blob = await (await fetch(link)).blob();
      const file = new File([blob], m.file, {type: 'application/pdf'});
      if (navigator.canShare?.({files: [file]})) {
        await navigator.share({files: [file], title: t.mailSubject});
        return;
      }
    } catch (error) {
      // The user closed the share sheet: nothing else to do.
      if ((error as Error)?.name === 'AbortError') return;
    }
    window.location.href = `mailto:?subject=${encodeURIComponent(t.mailSubject)}&body=${encodeURIComponent(link)}`;
  };
  const copy = async (m: ManualFile) => {
    await navigator.clipboard?.writeText(url(m)).catch(() => undefined);
    setCopied(m.file);
    window.setTimeout(() => setCopied(current => (current === m.file ? '' : current)), 2000);
  };

  const list = (['el', 'en'] as const).filter(l => manuals?.[l]).map(l => [l, manuals![l]!] as const);
  return (
    <main className="manual-special">
      <span className="manual-step-label">{t.label}</span>
      <h1>{t.title}</h1>
      <p>{t.body}</p>
      {manuals && !list.length && <p>{t.missing}</p>}
      <div className="owner-manuals">
        {list.map(([l, m]) => (
          <section key={l}>
            <div className="owner-manual-head">
              <FileText size={22} />
              <div>
                <b>{t.langs[l]}</b>
                <small>
                  {m.pages} {t.pages} · {(m.bytes / 1048576).toFixed(1)} MB · v{m.version} · {t.built} {m.built}
                </small>
              </div>
            </div>
            <div className="owner-manual-actions">
              <a className="app-button app-button-primary app-button-md" href={`${BASE}${m.file}`} download={m.file}>
                <Download size={16} />
                {t.download}
              </a>
              <AppButton icon={<Share2 size={16} />} onClick={() => void send(m)}>
                {t.share}
              </AppButton>
              <AppButton
                icon={copied === m.file ? <Check size={16} /> : <Link2 size={16} />}
                onClick={() => void copy(m)}
              >
                {copied === m.file ? t.copied : t.copy}
              </AppButton>
            </div>
          </section>
        ))}
      </div>
      <p className="owner-manuals-note">{t.rebuild}</p>
    </main>
  );
}
