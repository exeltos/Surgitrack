import {tr} from '../../i18n';
import {indicatorText, type Row} from './reportsMeta';

/** An indicator as a mark: ✓ passed, ✗ failed, … pending, – not done; its full text on hover and for screen readers. */
function Mark({name, code}: {name: string; code: string}) {
  const tone = code === 'PASS' ? 'pass' : code === 'FAIL' ? 'fail' : code === 'PENDING' ? 'pending' : 'none';
  const symbol = code === 'PASS' ? '✓' : code === 'FAIL' ? '✗' : code === 'PENDING' ? '…' : '–';
  const text = `${name}: ${indicatorText(code || undefined)}`;
  return (
    <span className={`load-mark ${tone}`} title={text}>
      <span aria-hidden="true">
        {name} {symbol}
      </span>
      <span className="visually-hidden">{text}</span>
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  RELEASED: 'ok',
  OPEN: 'busy',
  AWAITING_RELEASE: 'wait',
  REPROCESS: 'bad',
  FAILED: 'bad',
  RECALLED: 'bad',
};

/** The sterilizer loads report on screen: a cell shown otherwise than as text (the indicators, the state, the contents). */
export default function LoadCell({column, row}: {column: string; row: Row}) {
  if (column === 'indicators')
    return (
      <span className="load-marks">
        <Mark name={tr('Χημ.')} code={String(row.chemicalCode || '')} />
        <Mark name={tr('Βιολ.')} code={String(row.biologicalCode || '')} />
      </span>
    );
  if (column === 'loadStatus')
    return <span className={`load-status ${STATUS_TONE[String(row.loadCode)] || ''}`}>{String(row.loadStatus)}</span>;
  // How many, its barcodes one click away.
  return row.barcodes ? (
    <details className="load-items">
      <summary>{Number(row.items) === 1 ? tr('1 αντικείμενο') : tr('{0} αντικείμενα', row.items)}</summary>
      <span className="mono">{String(row.barcodes)}</span>
    </details>
  ) : (
    <>{String(row.items)}</>
  );
}
