import type {ReactNode} from 'react';

/** What is known about one item, patient or load: one line per fact, the label on the left. */
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
