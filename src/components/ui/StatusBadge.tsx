import {statusLabel} from './statusLabel';

export default function StatusBadge({value}: {value: string}) {
  const label = statusLabel(value);
  return (
    <span className={'badge badge-' + value.toLowerCase()} title={label}>
      {label}
    </span>
  );
}
