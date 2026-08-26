import type {ReactNode} from 'react';

type Props = {
  children: ReactNode;
  className?: string;
  withKpis?: boolean;
  ariaLabel?: string;
};

export default function ScrollableListPanel({children, className = '', withKpis = false, ariaLabel}: Props) {
  return (
    <div
      className={`panel table-panel list-scroll-panel${withKpis ? ' list-scroll-panel-kpis' : ''}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel}
    >
      {children}
    </div>
  );
}
