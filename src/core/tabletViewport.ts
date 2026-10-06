// A landscape tablet shows the desktop layout, scaled down to fit, instead of a separate cramped layout.
// The page is laid out at DESKTOP_WIDTH CSS pixels and the browser shrinks it to the screen width.
// Portrait tablets keep the responsive layout: scaling them would make text too small to read.
export const DESKTOP_WIDTH = 1280;
const MIN_TABLET_WIDTH = 900;

export function viewportContentFor(shortSide: number, longSide: number, touch: boolean, landscape: boolean): string {
  const scaled = touch && landscape && longSide >= MIN_TABLET_WIDTH && longSide < DESKTOP_WIDTH && shortSide >= 600;
  return scaled ? `width=${DESKTOP_WIDTH}` : 'width=device-width, initial-scale=1.0';
}

export function installTabletViewport() {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) return;
  const apply = () => {
    const {width, height} = window.screen;
    meta.content = viewportContentFor(
      Math.min(width, height),
      Math.max(width, height),
      window.matchMedia('(pointer: coarse)').matches,
      window.matchMedia('(orientation: landscape)').matches,
    );
  };
  apply();
  window.addEventListener('orientationchange', () => window.setTimeout(apply, 250));
}
