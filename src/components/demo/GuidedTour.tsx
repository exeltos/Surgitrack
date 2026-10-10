import {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {ArrowLeft, ArrowRight, X} from 'lucide-react';
import type {Tour} from '../../core/demoTours';

type Rect = {top: number; left: number; width: number; height: number};
const PAD = 6;
const NOTE_WIDTH = 320;

/** Where a place on the screen is now, a little larger; none when it is not on the screen. */
const rectOf = (selector?: string): Rect | null => {
  if (!selector) return null;
  const element = document.querySelector(selector);
  if (!element) return null;
  const box = element.getBoundingClientRect();
  if (!box.width && !box.height) return null;
  return {top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2};
};

/**
 * A guided tour over the real screen: the place each note is about stands out, the rest dims, and the
 * note sits next to it. The screen stays usable: a note waits for the person to press what it points at
 * (or "Next"), and a place not on the screen yet (a dialog still closed) is waited for.
 */
export default function GuidedTour({
  tour,
  L,
  onClose,
  onDone,
}: {
  tour: Tour;
  L: (el: string, en: string) => string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const stop = tour.stops[index];
  const last = index === tour.stops.length - 1;
  const next = () => (last ? onDone() : setIndex(i => i + 1));
  const nextRef = useRef(next);
  nextRef.current = next;

  // Follow the place as the screen scrolls, opens a dialog or changes.
  useLayoutEffect(() => {
    let frame = 0;
    const follow = () => {
      const now = rectOf(stop.target);
      setRect(prev =>
        prev && now && prev.top === now.top && prev.left === now.left && prev.width === now.width ? prev : now,
      );
      frame = requestAnimationFrame(follow);
    };
    follow();
    return () => cancelAnimationFrame(frame);
  }, [stop.target]);

  // Brought into view once, when the note moves to it.
  useEffect(() => {
    if (stop.target) document.querySelector(stop.target)?.scrollIntoView?.({block: 'nearest', behavior: 'smooth'});
  }, [stop.target, rect !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pressing what the note points at moves the tour on, once the screen has answered.
  useEffect(() => {
    if (stop.advance !== 'click' || !stop.target) return;
    const target = stop.target;
    const onClick = (event: MouseEvent) => {
      const element = document.querySelector(target);
      if (element && event.target instanceof Node && element.contains(event.target))
        window.setTimeout(() => nextRef.current(), 350);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [stop]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const viewport = {width: window.innerWidth, height: window.innerHeight};
  const width = Math.min(NOTE_WIDTH, viewport.width - 24);
  // Below the place when there is room, else above it; else (a large place) in the bottom-left corner.
  const below = rect && rect.top + rect.height + 190 < viewport.height;
  const above = rect && rect.top > 200;
  const note = !rect
    ? {top: viewport.height / 2, left: (viewport.width - width) / 2, transform: 'translateY(-50%)'}
    : below || above
      ? {
          top: below ? rect.top + rect.height + 10 : rect.top - 10,
          left: Math.min(Math.max(12, rect.left), viewport.width - width - 12),
          transform: below ? undefined : 'translateY(-100%)',
        }
      : {top: viewport.height - 16, left: 16, transform: 'translateY(-100%)'};
  const waiting = !!stop.target && !rect;

  return (
    <div className="guided-tour" role="dialog" aria-modal="false" aria-labelledby="guided-tour-title">
      {rect ? (
        <div
          className="guided-tour-spot"
          style={{top: rect.top, left: rect.left, width: rect.width, height: rect.height}}
        />
      ) : (
        <div className="guided-tour-dim" />
      )}
      <div className="guided-tour-note" style={{...note, width}}>
        <div className="guided-tour-head">
          <small>
            {L('Ξενάγηση', 'Tour')} · {index + 1}/{tour.stops.length}
          </small>
          <button type="button" onClick={onClose} aria-label={L('Τέλος ξενάγησης', 'End the tour')}>
            <X size={15} />
          </button>
        </div>
        <strong id="guided-tour-title">{L(stop.title.el, stop.title.en)}</strong>
        <p>{L(stop.text.el, stop.text.en)}</p>
        {waiting && (
          <small className="guided-tour-wait">
            {L('Συνεχίζει μόλις εμφανιστεί στην οθόνη.', 'It goes on as soon as it is on the screen.')}
          </small>
        )}
        <div className="guided-tour-actions">
          {index > 0 && (
            <button type="button" onClick={() => setIndex(i => i - 1)}>
              <ArrowLeft size={14} /> {L('Πίσω', 'Back')}
            </button>
          )}
          <button type="button" className="primary" onClick={next}>
            {last ? L('Τέλος', 'Done') : stop.advance === 'click' ? L('Παράλειψη', 'Skip') : L('Επόμενο', 'Next')}{' '}
            {!last && <ArrowRight size={14} />}
          </button>
        </div>
      </div>
    </div>
  );
}
