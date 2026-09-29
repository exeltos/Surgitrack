import type {ReactNode} from 'react';
import {Link} from 'react-router-dom';

type KpiItem = {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  /** Opens this link (e.g. a list with matching filters). */
  to?: string;
  /** Applies the matching filters on the current page. */
  onClick?: () => void;
  /** The KPI's filters are the ones in effect now. */
  active?: boolean;
};

type Props = {
  items: KpiItem[];
  compact?: boolean;
  className?: string;
};

export default function KpiStrip({items, compact = false, className = ''}: Props) {
  return (
    <div className={`kpis${compact ? ' compact-kpis' : ''}${className ? ` ${className}` : ''}`}>
      {items.map((item, index) => {
        const body = (
          <>
            {item.icon}
            <small>{item.label}</small>
            <strong>{item.value}</strong>
          </>
        );
        const cls = `kpi-item${item.to || item.onClick ? ' kpi-link' : ''}${item.active ? ' active' : ''}`;
        if (item.to)
          return (
            <Link key={index} to={item.to} className={cls}>
              {body}
            </Link>
          );
        if (item.onClick)
          return (
            <button key={index} type="button" className={cls} onClick={item.onClick} aria-pressed={!!item.active}>
              {body}
            </button>
          );
        return (
          <div key={index} className={cls}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
