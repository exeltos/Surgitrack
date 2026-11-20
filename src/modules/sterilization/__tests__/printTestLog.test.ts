import {describe, expect, it} from 'vitest';
import {dailyTestLogHtml} from '../printTestLog';

describe('the daily test sheet', () => {
  it('lists every sterilizer in use it counts, one with nothing due today too', () => {
    const now = new Date(2026, 10, 18, 9, 0);
    const html = dailyTestLogHtml(
      'Νοσοκομείο',
      [
        {el: 'Κλίβανος Α'},
        {el: 'Κλίβανος Β', outOfService: {reason: 'MAINTENANCE'}},
        // Plasma: only its weekly spore test, done two days ago, so nothing today.
        {
          el: 'Πλάσμα STERRAD 100NX',
          tests: [{id: 't1', kind: 'BIOLOGICAL', result: 'PASS', at: '16/11/2026 08:15', by: 'Μαρία'}],
        },
      ],
      'STERILIZER',
      now,
    );
    expect(html).toContain('Κλίβανος Α');
    expect(html).not.toContain('Κλίβανος Β');
    expect(html).toContain('Πλάσμα STERRAD 100NX');
    expect(html).toContain('Καμία δοκιμή σήμερα');
    // The header counts the two in use, and both have their lines.
    expect(html).toContain('Κλίβανοι: 2');
  });
});
