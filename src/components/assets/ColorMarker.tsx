import {useColorTapes} from './colorMarkerUtils';
import {useAppPreferences} from '../../core/AppPreferences';
import type {ColorTape} from '../../core/colorTapes';

/** One tape as it looks on the instrument: its colors as stripes, with its text or symbol. */
export function TapeSwatch({tape, size = 'md'}: {tape?: ColorTape; size?: 'sm' | 'md' | 'lg'}) {
  const {lang} = useAppPreferences();
  if (!tape)
    return (
      <span className={`tape-swatch tape-${size} missing`} title="?">
        ?
      </span>
    );
  const stops = tape.colors
    .map((color, i) => `${color} ${(i * 100) / tape.colors.length}% ${((i + 1) * 100) / tape.colors.length}%`)
    .join(', ');
  const dark = tape.colors.length === 1 && isDark(tape.colors[0]);
  return (
    <span
      className={`tape-swatch tape-${size}`}
      style={{background: `linear-gradient(90deg, ${stops})`}}
      title={lang === 'el' ? tape.el : tape.en}
    >
      {tape.label && <b className={dark ? 'on-dark' : ''}>{tape.label}</b>}
    </span>
  );
}

const isDark = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return r * 0.299 + g * 0.587 + b * 0.114 < 140;
};

/** A marker: 1-3 tapes in order. Renders nothing for an empty marker unless `empty` is given. */
export default function ColorMarker({
  tapes,
  size = 'md',
  empty,
}: {
  tapes?: string[];
  size?: 'sm' | 'md' | 'lg';
  empty?: string;
}) {
  const byId = useColorTapes();
  const {lang} = useAppPreferences();
  if (!tapes?.length) return empty ? <span className="color-marker-empty">{empty}</span> : null;
  const names = tapes.map(id => {
    const tape = byId.get(id);
    return tape ? (lang === 'el' ? tape.el : tape.en) : '?';
  });
  return (
    <span className={`color-marker color-marker-${size}`} title={names.join(' + ')} aria-label={names.join(' + ')}>
      {tapes.map((id, i) => (
        <TapeSwatch key={`${id}-${i}`} tape={byId.get(id)} size={size} />
      ))}
    </span>
  );
}
