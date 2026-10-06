import {describe, expect, it} from 'vitest';
import {viewportContentFor} from '../tabletViewport';

const SCALED = 'width=1280';
const NORMAL = 'width=device-width, initial-scale=1.0';

describe('viewportContentFor', () => {
  it('scales a landscape tablet to the desktop width', () => {
    expect(viewportContentFor(768, 1024, true, true)).toBe(SCALED);
    expect(viewportContentFor(820, 1180, true, true)).toBe(SCALED);
  });
  it('keeps portrait tablets responsive', () => {
    expect(viewportContentFor(768, 1024, true, false)).toBe(NORMAL);
  });
  it('does not touch desktops, big tablets or phones', () => {
    expect(viewportContentFor(900, 1440, false, true)).toBe(NORMAL);
    expect(viewportContentFor(1024, 1366, true, true)).toBe(NORMAL);
    expect(viewportContentFor(390, 844, true, true)).toBe(NORMAL);
  });
});
