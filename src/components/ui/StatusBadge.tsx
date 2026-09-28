import {statusLabel} from './statusLabel';

export default function StatusBadge({value}: {value: string}) {
  return <span className={'badge badge-' + value.toLowerCase()}>{statusLabel(value)}</span>;
}
