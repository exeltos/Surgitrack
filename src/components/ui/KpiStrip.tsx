import type {ReactNode} from 'react';

type KpiItem = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
};

type Props = {
  items: KpiItem[];
  compact?: boolean;
  className?: string;
};

export default function KpiStrip({items, compact = false, className = ''}: Props) {
  return (
    <div className={`kpis${compact ? ' compact-kpis' : ''}${className ? ` ${className}` : ''}`}>
      {items.map((item, index) => (
        <div key={index}>
          {item.icon}
          {<small>{item.label}</small>}
          <strong>{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
