import {useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
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
  const [place, setPlace] = useState<CSSProperties>();
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // The panel floats over the page at the button (fixed), so a list that scrolls or clips its rows cannot cut
  // it off; it opens upwards when there is no room below, and stays inside the screen's width.
  useLayoutEffect(() => {
    if (!open) {
      setPlace(undefined);
      return;
    }
    const toggle = wrap.current?.querySelector('button');
    const menu = panel.current;
    if (!toggle || !menu) return;
    const button = toggle.getBoundingClientRect();
    const {width, height} = menu.getBoundingClientRect();
    const gap = 6;
    const below = button.bottom + gap + height <= window.innerHeight - 8 || button.top - gap - height < 8;
    const wanted = align === 'right' ? button.right - width : button.left;
    setPlace({
      position: 'fixed',
      top: below ? button.bottom + gap : button.top - gap - height,
      left: Math.max(8, Math.min(wanted, window.innerWidth - width - 8)),
      right: 'auto',
    });
  }, [open, align]);

  // Close on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    // Fixed at the button: when the page or a list scrolls, or the window changes size, it closes.
    const onMove = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
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
        <div
          ref={panel}
          className={`action-menu-panel align-${align}`}
          role="menu"
          style={place || {visibility: 'hidden'}}
        >
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
