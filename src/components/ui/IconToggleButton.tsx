import type {ButtonHTMLAttributes, ReactNode} from 'react';

type Props = {
  active: boolean;
  activeIcon: ReactNode;
  inactiveIcon: ReactNode;
  activeTitle: string;
  inactiveTitle: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'title'>;

export default function IconToggleButton({
  active,
  activeIcon,
  inactiveIcon,
  activeTitle,
  inactiveTitle,
  className = '',
  ...props
}: Props) {
  return (
    <button
      type="button"
      className={`${active ? 'icon-toggle active' : 'icon-toggle'}${className ? ` ${className}` : ''}`}
      title={active ? activeTitle : inactiveTitle}
      aria-pressed={active}
      {...props}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
  );
}
