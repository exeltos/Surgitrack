import type {ReactNode} from 'react';
import type {LucideIcon} from 'lucide-react';
import {tr} from '../../i18n';

/** What is known about one item, patient or load: low cards in one row, the label on top. */
export default function InfoList({label, rows}: {label: string; rows: Array<{label: string; value: ReactNode}>}) {
  return (
    <dl className="trace-info" aria-label={label}>
      {rows.map(row => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A card whose fact was never recorded: said, not left out, so every card keeps its place. */
export const Missing = () => <span className="trace-missing">{tr('Λείπει καταχώρηση')}</span>;

/** The empty side of a split, before anything is picked: a picture and what to do. */
export function SplitEmpty({icon: Icon, title, text}: {icon: LucideIcon; title: string; text: string}) {
  return (
    <div className="trace-split-empty">
      <span className="trace-split-empty-art" aria-hidden="true">
        <Icon size={44} strokeWidth={1.5} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
