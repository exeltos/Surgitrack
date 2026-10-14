import {createContext, useContext, useState, type ReactNode} from 'react';
import {ArrowLeft, CheckCircle2, FileDown, FlaskConical, Plus, X} from 'lucide-react';
import {getRuntimeDataMode} from '../../config/dataMode';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import {tr, trData} from '../../i18n';
import {useCompositionOptions} from '../../components/assets/usePrintLook';
import {tellUser} from '../../components/ui/confirmService';
import {compositionLines} from '../../core/compositionCheck';
import {formatDateTime} from '../../core/displayDate';
import {htmlToPdf, shareOrDownloadPdf} from '../../core/htmlToPdf';
import {useSurgi} from '../../store/SurgiStore';
import {compositionHtml} from '../sterilization/printUtils';
import type {Issue, SetAsset, Tool} from '../../types/domain';
import type {SterilizationRow} from '../sterilization/sterilizationTypes';

/** The station a screen belongs to: its icon and colour, shown in the screen's header. */
export const ScanStationLook = createContext<{icon?: ReactNode; tone?: string}>({});

/** One screen of the phone app: a dark header with the way back, the content, and its main button. */
export function ScanScreen({
  title,
  subtitle,
  backLabel,
  onBack,
  footer,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  backLabel: string;
  onBack: () => void;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const look = useContext(ScanStationLook);
  return (
    <div className="scan-screen">
      <header className="scan-head">
        <button type="button" className="scan-back" onClick={onBack}>
          <ArrowLeft size={17} /> {backLabel}
        </button>
        <div className="scan-head-title">
          {look.icon && (
            <span className={`scan-head-icon ${look.tone || ''}`} aria-hidden="true">
              {look.icon}
            </span>
          )}
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
        </div>
      </header>
      <main className="scan-body">{children}</main>
      {footer && <footer className="scan-foot">{footer}</footer>}
    </div>
  );
}

/** The Sets and instruments scanned so far, newest first, each with a way to take it out again. */
export function ScanItemList({
  items,
  onRemove,
  empty,
}: {
  items: SterilizationRow[];
  onRemove?: (item: SterilizationRow) => void;
  empty: string;
}) {
  if (!items.length) return <p className="scan-empty">{empty}</p>;
  return (
    <ul className="scan-items">
      {[...items].reverse().map(item => (
        <li key={`${item.kind}:${item.id}`}>
          <AssetTypeIcon kind={item.kind} maxUses={item.kind === 'TOOL' ? item.maxUses : undefined} size={16} />
          <span>
            <b>
              <span className="mono">{item.barcode}</span> · {item.name}
            </b>
            <small>
              {item.kind === 'SET' ? tr('Σετ') : tr('Μεμονωμένο εργαλείο')} ·{' '}
              {trData(item.department) || tr('Χωρίς τμήμα')}
            </small>
          </span>
          {onRemove && (
            <button
              type="button"
              className="scan-item-remove"
              aria-label={tr('Αφαίρεση {0}', item.barcode)}
              title={tr('Αφαίρεση')}
              onClick={() => onRemove(item)}
            >
              <X size={16} />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Scans refused in this session (wrong stage, another department, unknown): kept in view, newest first. */
export function ScanRefused({messages}: {messages: string[]}) {
  if (!messages.length) return null;
  return (
    <ul className="scan-refused" aria-label={tr('Δεν προστέθηκαν')}>
      {messages.map((message, i) => (
        <li key={`${i}:${message}`}>{message}</li>
      ))}
    </ul>
  );
}

/** The end of a station's round: what was recorded, then another round or back to the stations. */
export function ScanDone({
  title,
  text,
  again,
  onAgain,
  onStations,
}: {
  title: string;
  text?: string;
  again: string;
  onAgain: () => void;
  onStations: () => void;
}) {
  return (
    <div className="scan-done" role="status">
      <CheckCircle2 size={54} />
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      <button type="button" className="scan-primary" onClick={onAgain}>
        {again}
      </button>
      <button type="button" className="scan-secondary" onClick={onStations}>
        {tr('Αρχική')}
      </button>
    </div>
  );
}

/**
 * A Set's composition sheet, as printed from the Set's page: one row per kind of instrument with its code
 * and how many there should be and are, what is missing, and open issues (Βλάβη, Φθορά…).
 */
export function SetContents({set, tools, issues}: {set: SetAsset; tools: Tool[]; issues: Issue[]}) {
  const problems = new Map<string, string[]>();
  for (const issue of issues) {
    if (issue.status !== 'OPEN') continue;
    const barcode = issue.asset.split(' · ')[0];
    problems.set(barcode, [...(problems.get(barcode) || []), trData(issue.type)]);
  }
  const lines = compositionLines(set.compositionTemplate, tools, problems);
  const templated = !!set.compositionTemplate?.length;
  const expected = templated ? lines.reduce((sum, line) => sum + (line.expected || 0), 0) : set.expected;
  const missing = lines.reduce((sum, line) => sum + line.missing, 0);
  return (
    <section className="scan-form" aria-label={tr('Σύνθεση Σετ')}>
      <h2 className="scan-section">
        {tr('Σύνθεση Σετ')}{' '}
        <span>
          {tools.length}
          {expected ? ` / ${expected}` : ''}
        </span>
      </h2>
      {missing > 0 && (
        <p className="scan-form-alert">
          {missing === 1 ? tr('Λείπει 1 εργαλείο') : tr('Λείπουν {0} εργαλεία', missing)}
        </p>
      )}
      {lines.length ? (
        <ol className="scan-form-lines">
          {lines.map((line, index) => (
            <li
              key={`${line.code}:${line.name}:${index}`}
              className={line.missing ? 'missing' : line.problems.length ? 'issue' : ''}
            >
              <span className="scan-form-num">{index + 1}</span>
              <span className="scan-form-name">
                <b>{line.name}</b>
                <small>
                  {line.code}
                  {line.manufacturer !== '—' ? ` · ${line.manufacturer}` : ''}
                </small>
                {line.missing > 0 && (
                  <em className="miss">{line.missing === 1 ? tr('Λείπει 1') : tr('Λείπουν {0}', line.missing)}</em>
                )}
                {line.problems.length > 0 && <em className="prob">{line.problems.join(' · ')}</em>}
              </span>
              <span className="scan-form-qty" aria-label={tr('Παρόντα / αναμενόμενα')}>
                {line.present}
                {line.expected !== undefined ? <small>/{line.expected}</small> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="scan-empty">{tr('Το Σετ δεν έχει εργαλεία.')}</p>
      )}
    </section>
  );
}

/** The Set's composition sheet as a PDF file, the same sheet the Set's page prints: shared or downloaded. */
export function SetPdfButton({set, tools}: {set: SetAsset; tools: Tool[]}) {
  const {issues, currentUser} = useSurgi();
  const compositionOptions = useCompositionOptions();
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      const problems = issues
        .filter(
          issue =>
            issue.status === 'OPEN' &&
            (issue.asset.startsWith(set.barcode) || tools.some(tool => issue.asset.startsWith(tool.barcode))),
        )
        .map(issue => ({barcode: issue.asset.split(' · ')[0], type: issue.type}));
      const html = compositionHtml(
        set,
        tools,
        currentUser.name,
        formatDateTime(),
        problems,
        compositionOptions(set.colorTapes),
      );
      const blob = await htmlToPdf(html);
      await shareOrDownloadPdf(blob, `${set.barcode}.pdf`, tr('Σύνθεση {0}', set.barcode));
    } catch {
      void tellUser(tr('PDF'), tr('Δεν ήταν δυνατή η δημιουργία του PDF. Δοκιμάστε ξανά.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button type="button" className="scan-secondary" disabled={busy} onClick={() => void make()}>
      {busy ? <span className="app-spinner inline" aria-hidden="true" /> : <FileDown size={18} />}{' '}
      {busy ? tr('Δημιουργία PDF…') : tr('PDF σύνθεσης')}
    </button>
  );
}

/** A Set or instrument offered in the Demo's waiting list. */
export type DemoItem = {
  kind: 'SET' | 'TOOL';
  id: string;
  barcode: string;
  name: string;
  department?: string;
  maxUses?: number;
};

/** How many waiting items the Demo lists. */
const DEMO_SHOWN = 12;

/**
 * Demo only (a presentation has no labels to scan): what is waiting at this station, each one tapped in as if
 * scanned, through the same scan handler and rules. Never shown in a real hospital, where a scan proves the
 * instrument is in hand.
 */
export function DemoWaiting({items, onPick}: {items: DemoItem[]; onPick: (barcode: string) => void}) {
  if (getRuntimeDataMode() !== 'DEMO' || !items.length) return null;
  return (
    <section className="scan-demo-waiting" aria-label={tr('Demo · σε αναμονή')}>
      <h2 className="scan-section">
        <FlaskConical size={16} /> {tr('Demo · σε αναμονή')} <span>{items.length}</span>
      </h2>
      <p>{tr('Χωρίς ετικέτες: πατήστε ένα για να μπει σαν σκαναρισμένο.')}</p>
      <ul>
        {items.slice(0, DEMO_SHOWN).map(item => (
          <li key={`${item.kind}:${item.id}`}>
            <button type="button" onClick={() => onPick(item.barcode)}>
              <AssetTypeIcon kind={item.kind} maxUses={item.kind === 'TOOL' ? item.maxUses : undefined} size={16} />
              <span className="scan-demo-text">
                <b>
                  <span className="mono">{item.barcode}</span> · {item.name}
                </b>
                {item.department && <small>{trData(item.department)}</small>}
              </span>
              <Plus size={18} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
