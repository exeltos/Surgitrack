import {Gauge, Layers3, Wrench} from 'lucide-react';
import type {AssetKind} from '../../types/domain';
import {tr} from '../../i18n';

type Props = {
  kind: AssetKind;
  maxUses?: number;
  size?: number;
  className?: string;
  framed?: boolean;
};

export default function AssetTypeIcon({kind, maxUses, size = 18, className = '', framed = false}: Props) {
  const limited = kind === 'TOOL' && Boolean(maxUses);
  const label = tr(kind === 'SET' ? 'Σετ εργαλείων' : limited ? 'Εργαλείο περιορισμένων χρήσεων' : 'Εργαλείο');
  const icon = kind === 'SET' ? <Layers3 size={size} /> : limited ? <Gauge size={size} /> : <Wrench size={size} />;
  if (!framed)
    return (
      <span
        className={`asset-type-icon-inline ${kind.toLowerCase()} ${limited ? 'limited' : ''} ${className}`.trim()}
        title={label}
        aria-label={label}
      >
        {icon}
      </span>
    );
  return (
    <span
      className={`asset-type-icon ${kind.toLowerCase()} ${limited ? 'limited' : ''} ${className}`.trim()}
      title={label}
      aria-label={label}
    >
      {icon}
    </span>
  );
}
