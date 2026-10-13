import type {ReactNode} from 'react';
import {ArrowLeft, CheckCircle2, X} from 'lucide-react';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import {tr, trData} from '../../i18n';
import {compositionLines} from '../../core/compositionCheck';
import type {Issue, SetAsset, Tool} from '../../types/domain';
import type {SterilizationRow} from '../sterilization/sterilizationTypes';

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
  return (
    <div className="scan-screen">
      <header className="scan-head">
        <button type="button" className="scan-back" onClick={onBack}>
          <ArrowLeft size={17} /> {backLabel}
        </button>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
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
