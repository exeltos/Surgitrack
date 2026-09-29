import {useEffect, useRef, useState} from 'react';
import {Maximize2, Minus, Plus, ScanSearch, X} from 'lucide-react';

const text = {
  el: {
    preview: 'Προεπισκόπηση οθόνης',
    demo: 'με δεδομένα demo',
    zoom: 'Μεγέθυνση',
    zoomIn: 'Μεγέθυνση',
    zoomOut: 'Σμίκρυνση',
    fit: 'Προσαρμογή',
    close: 'Κλείσιμο προεπισκόπησης',
    hint: 'Κάντε κλικ στην εικόνα για μεγέθυνση · σύρετε ή κυλήστε για μετακίνηση',
  },
  en: {
    preview: 'Screen preview',
    demo: 'with demo data',
    zoom: 'Zoom',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Fit',
    close: 'Close preview',
    hint: 'Click the image to zoom · drag or scroll to move around',
  },
};
const LEVELS = [0.5, 0.75, 1, 1.5, 2];

/** Screenshot of a screen, always taken from the demo hospital; opens full size with zoom. */
export default function ScreenPreview({
  src,
  title,
  lang,
  onOpenChange,
}: {
  src: string;
  title: string;
  lang: 'el' | 'en';
  onOpenChange: (open: boolean) => void;
}) {
  const tx = text[lang];
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);
  /** null = fit to the window. */
  const [zoom, setZoom] = useState<number | null>(null);
  const [natural, setNatural] = useState(1440);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{x: number; y: number; left: number; top: number; moved: boolean} | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMissing(false), [src]);
  useEffect(() => {
    onOpenChange(open);
    if (open) closeRef.current?.focus();
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === '+' || event.key === '=') step(1);
      if (event.key === '-') step(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (missing) return null;
  const level = zoom ?? 0;
  const step = (dir: 1 | -1) => {
    const now = zoom ?? 1;
    const next = dir > 0 ? LEVELS.find(l => l > now + 0.01) : [...LEVELS].reverse().find(l => l < now - 0.01);
    setZoom(next ?? now);
  };

  return (
    <>
      <button
        type="button"
        className="manual-screen-thumb"
        onClick={() => setOpen(true)}
        aria-label={`${tx.preview}: ${title}`}
      >
        <img src={src} alt="" loading="lazy" onError={() => setMissing(true)} />
        <span>
          <ScanSearch size={14} /> {tx.preview} · {tx.demo}
        </span>
      </button>
      {open && (
        <div className="manual-lightbox" role="dialog" aria-modal="true" aria-label={`${tx.preview}: ${title}`}>
          <header>
            <strong>
              {title} <small>· {tx.demo}</small>
            </strong>
            <div className="manual-lightbox-tools">
              <button type="button" onClick={() => step(-1)} aria-label={tx.zoomOut} disabled={zoom === LEVELS[0]}>
                <Minus size={15} />
              </button>
              <span aria-live="polite">{zoom ? `${Math.round(zoom * 100)}%` : tx.fit}</span>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={tx.zoomIn}
                disabled={zoom === LEVELS[LEVELS.length - 1]}
              >
                <Plus size={15} />
              </button>
              <button type="button" onClick={() => setZoom(null)} className={zoom ? '' : 'active'}>
                <Maximize2 size={14} /> {tx.fit}
              </button>
              <button type="button" ref={closeRef} onClick={() => setOpen(false)} aria-label={tx.close}>
                <X size={16} />
              </button>
            </div>
          </header>
          <div
            ref={stageRef}
            className={`manual-lightbox-stage${zoom ? ' zoomed' : ''}`}
            onPointerDown={e => {
              const stage = stageRef.current;
              if (!stage) return;
              drag.current = {x: e.clientX, y: e.clientY, left: stage.scrollLeft, top: stage.scrollTop, moved: false};
            }}
            onPointerMove={e => {
              const stage = stageRef.current;
              const d = drag.current;
              if (!stage || !d || !zoom) return;
              const dx = e.clientX - d.x;
              const dy = e.clientY - d.y;
              if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
              stage.scrollLeft = d.left - dx;
              stage.scrollTop = d.top - dy;
            }}
            onPointerUp={e => {
              const d = drag.current;
              drag.current = null;
              if (d?.moved) return;
              const stage = stageRef.current;
              const img = stage?.querySelector('img');
              if (!stage || !img) return;
              // Click: fit ⇄ 150%, keeping the clicked point under the pointer.
              const rect = img.getBoundingClientRect();
              const fx = (e.clientX - rect.left) / rect.width;
              const fy = (e.clientY - rect.top) / rect.height;
              const next = zoom ? null : 1.5;
              setZoom(next);
              if (next)
                requestAnimationFrame(() => {
                  stage.scrollLeft = fx * img.scrollWidth - stage.clientWidth / 2;
                  stage.scrollTop = fy * img.scrollHeight - stage.clientHeight / 2;
                });
            }}
          >
            <img
              src={src}
              alt={title}
              draggable={false}
              onLoad={e => setNatural(e.currentTarget.naturalWidth || 1440)}
              style={zoom ? {width: `${level * natural}px`, maxWidth: 'none'} : undefined}
            />
          </div>
          <footer>{tx.hint}</footer>
        </div>
      )}
    </>
  );
}
