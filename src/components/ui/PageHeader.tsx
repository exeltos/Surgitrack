import type {ReactNode} from 'react';

type Props = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function PageHeader({eyebrow, title, description, actions, className = ''}: Props) {
  return (
    <div className={`page-head asset-list-head${className ? ` ${className}` : ''}`}>
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions}
    </div>
  );
}
