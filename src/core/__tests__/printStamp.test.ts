import {afterEach, describe, expect, it} from 'vitest';
import {markPrintHtml} from '../sampleDataMark';
import {printHospital, printedLine, setPrintStamp} from '../printStamp';

describe('the common foot of the prints', () => {
  afterEach(() => setPrintStamp({}));

  it('names the hospital and the person printing', () => {
    setPrintStamp({hospital: 'Γενικό Νοσοκομείο Άρτας', user: 'Νίκος Παππάς'});
    expect(printHospital()).toBe('Γενικό Νοσοκομείο Άρτας');
    expect(printHospital('Άλλο')).toBe('Άλλο');
    expect(printedLine()).toMatch(/^Εκτυπώθηκε .+ · Νίκος Παππάς$/);
  });

  it('falls back to SurgiTrack without a hospital', () => {
    expect(printHospital()).toBe('SurgiTrack');
  });

  it('puts the foot and the page numbers on an A4 page once, never on a label', () => {
    setPrintStamp({hospital: 'Νοσοκομείο "Α"', user: 'Μαρία'});
    const a4 = markPrintHtml('<style>@page{size:A4 portrait}</style><body>x</body>');
    expect(a4).toContain('@bottom-left{content:"Νοσοκομείο \\"Α\\" · Εκτυπώθηκε');
    expect(a4).toContain('counter(pages)');
    expect(markPrintHtml(a4)).toBe(a4);
    const label = '<style>@page{size:50mm 25mm;margin:0}</style><body>x</body>';
    expect(markPrintHtml(label)).toBe(label);
  });
});
