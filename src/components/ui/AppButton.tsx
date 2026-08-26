import type {ButtonHTMLAttributes, ReactNode} from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

export default function AppButton({
  variant = 'secondary',
  size = 'md',
  icon,
  children,
  className = '',
  ...props
}: {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`app-button app-button-${variant} app-button-${size} ${className}`.trim()} {...props}>
      {icon}
      {children}
    </button>
  );
}
