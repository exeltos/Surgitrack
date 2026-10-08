import {useEffect, useRef, useState, type ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';

export type ActionMenuItem = {
  key: string;
  icon: ReactNode;
  label: string;
  hint?: string;
  onSelect: () => void;
  disabled?: boolean;
  /** Why it is disabled, shown as the item's tooltip. */
  title?: string;
  danger?: boolean;
};

/** A toolbar button that opens a short list of related actions. Hidden when it has none. */
export default function ActionMenu({
  icon,
  label,
  items,
  align = 'left',
  variant = 'secondary',
  disabled,
  title,
}: {
  icon: ReactNode;
  label: string;
  items: ActionMenuItem[];
  align?: 'left' | 'right';
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  /** The button's tooltip (e.g. why it is disabled). */
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!items.length) return null;
  return (
    <div className="action-menu" ref={wrap}>
      <button
        type="button"
        className={`app-button app-button-${variant} app-button-md action-menu-toggle ${open ? 'open' : ''}`}
        disabled={disabled}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown size={15} className="action-menu-caret" />
      </button>
      {open && (
        <div className={`action-menu-panel align-${align}`} role="menu">
          {items.map(item => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={item.danger ? 'danger' : ''}
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.icon}
              <span>
                <b>{item.label}</b>
                {item.hint && <small>{item.hint}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
