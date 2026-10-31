import {afterEach, describe, expect, it} from 'vitest';
import {printLogo, printLogoHtml, setPrintLogo} from '../printBranding';
import {tableReportHtml} from '../exportTable';
import {genericReportHtml} from '../../modules/reports/reportsMeta';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('the hospital logo on prints', () => {
  afterEach(() => setPrintLogo(undefined));

  it('is on a print once the hospital has one, and absent without', () => {
    expect(printLogoHtml()).toBe('');
    expect(tableReportHtml({title: 'Πίνακας', headers: ['Α'], rows: [['1']]}, 'el')).not.toContain('hospital-logo');
    setPrintLogo(PNG);
    expect(printLogo()).toBe(PNG);
    expect(tableReportHtml({title: 'Πίνακας', headers: ['Α'], rows: [['1']]}, 'el')).toContain(`src="${PNG}"`);
    expect(genericReportHtml('Αναφορά', 'υπότιτλος', [{key: 'a', label: 'Α'}], [{a: 1}])).toContain(`src="${PNG}"`);
  });

  it('keeps SurgiTrack as the mark when there is no logo', () => {
    expect(genericReportHtml('Αναφορά', '', [{key: 'a', label: 'Α'}], [{a: 1}])).toContain('class="brand">SurgiTrack');
  });

  it('accepts only a small image data URL', () => {
    setPrintLogo('https://example.com/logo.png');
    expect(printLogo()).toBeUndefined();
    setPrintLogo('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');
    expect(printLogo()).toBeUndefined();
  });
});
