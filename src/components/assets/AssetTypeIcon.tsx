import {Gauge, Layers3, SearchCheck, Wrench} from 'lucide-react';
import type {AssetKind} from '../../types/domain';
import {tr} from '../../i18n';

type Props = {
  kind: AssetKind;
  maxUses?: number;
  /** Uses with a wear check: no limit, the instrument is checked for wear (its own icon). */
  wearCheck?: boolean;
  size?: number;
  className?: string;
  framed?: boolean;
};

export default function AssetTypeIcon({kind, maxUses, wearCheck, size = 18, className = '', framed = false}: Props) {
  const limited = kind === 'TOOL' && Boolean(maxUses);
  const wear = kind === 'TOOL' && !limited && Boolean(wearCheck);
  const label =
    kind === 'SET'
      ? tr('Σετ εργαλείων')
      : limited
        ? tr('Εργαλείο περιορισμένων χρήσεων')
        : wear
          ? tr('Εργαλείο με έλεγχο φθοράς')
          : tr('Εργαλείο');
  const icon =
    kind === 'SET' ? (
      <Layers3 size={size} />
    ) : limited ? (
      <Gauge size={size} />
    ) : wear ? (
      <SearchCheck size={size} />
    ) : (
      <Wrench size={size} />
    );
  const variant = limited ? 'limited' : wear ? 'wear' : '';
  return (
    <span
      className={`${framed ? 'asset-type-icon' : 'asset-type-icon-inline'} ${kind.toLowerCase()} ${variant} ${className}`.trim()}
      role="img"
      title={label}
      aria-label={label}
    >
      {icon}
    </span>
  );
}
