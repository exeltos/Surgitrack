import {describe, expect, it} from 'vitest';
import {browserOf, sinceLabel} from '../securitySessions';

const L = (el: string) => el;

describe('the owner’s list of who is connected', () => {
  it('names the browser and the system, and copes with a missing one', () => {
    expect(
      browserOf(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      ),
    ).toBe('Chrome · Windows');
    expect(
      browserOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36 Edg/130.0'),
    ).toBe('Edge · Windows');
    expect(browserOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Gecko/20100101 Firefox/132.0')).toBe(
      'Firefox · macOS',
    );
    expect(browserOf(null)).toBe('—');
  });

  it('says how long ago a person was seen', () => {
    const now = Date.parse('2026-11-10T12:00:00Z');
    expect(sinceLabel('2026-11-10T11:59:50Z', now, L)).toBe('τώρα');
    expect(sinceLabel('2026-11-10T11:59:20Z', now, L)).toBe('πριν 40 δευτ.');
    expect(sinceLabel('2026-11-10T11:56:00Z', now, L)).toBe('πριν 4 λεπτά');
  });
});
