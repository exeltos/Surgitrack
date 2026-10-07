import {describe, expect, it} from 'vitest';
import {barcodeLabelHtml, compositionHtml} from '../printUtils';
import type {SetAsset, Tool} from '../../../types/domain';

const tool = {barcode: 'T000001', name: 'KOCHER', department: 'Χειρουργείο', uses: 3, maxUses: 30} as Tool;

describe('barcode label', () => {
  it('prints at the chosen size with the chosen header', () => {
    const small = barcodeLabelHtml(tool, 'TOOL', undefined, {
      size: 'SMALL',
      header: 'TEXT',
      text: 'ΙΑΣΩ',
      showDetails: true,
    });
    expect(small).toContain('@page{size:50mm 25mm');
    expect(small).toContain('ΙΑΣΩ');
    expect(small).toContain('3 / 30');
    const sheet = barcodeLabelHtml(tool, 'TOOL', undefined, {size: 'SHEET', header: 'NONE', showDetails: false});
    expect(sheet).toContain('@page{size:100mm 50mm');
    expect(sheet).not.toContain('SurgiTrack');
    expect(sheet).not.toContain('3 / 30');
  });
  it('shows only image data URLs as the logo', () => {
    const logo = 'data:image/png;base64,AAAA';
    expect(
      barcodeLabelHtml(tool, 'TOOL', undefined, {size: 'SMALL', header: 'LOGO', logo, showDetails: true}),
    ).toContain(`<img class="logo" src="${logo}"`);
    const unsafe = barcodeLabelHtml(tool, 'TOOL', undefined, {
      size: 'SMALL',
      header: 'LOGO',
      logo: 'javascript:alert(1)',
      showDetails: true,
    });
    expect(unsafe).not.toContain('javascript:');
  });
});

describe('composition sheet', () => {
  it('numbers the rows, counts quantities and leaves room for signatures', () => {
    const set = {barcode: 'S000001', name: 'ΒΑΣΙΚΟ', department: 'Χειρουργείο', specialty: 'Ορθοπεδική'} as SetAsset;
    const tools = [
      {barcode: 'T1', name: 'KOCHER', code: '12.320.20', manufacturer: 'DEWIMED'},
      {barcode: 'T2', name: 'KOCHER', code: '12.320.20', manufacturer: 'DEWIMED'},
      {barcode: 'T3', name: 'RICHARSON', code: '', manufacturer: 'DEWIMED'},
    ] as Tool[];
    const html = compositionHtml(set, tools, 'Demo', '29/09/2026', [{barcode: 'T3', type: 'Βλάβη'}], {
      marker: [{name: 'Μπλε', colors: ['#1f5fbf']}],
    });
    expect(html).toContain('<td class="qty">2</td>');
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('class="issue"');
    expect(html).toContain('Ονοματεπώνυμο & υπογραφή');
    expect(html).toContain('Μπλε');
    expect(html).toContain('Βλάβη');
  });

  it('marks what the template expects but the Set does not hold', () => {
    const set = {
      barcode: 'S000002',
      name: 'ΛΑΠΑΡΟΤΟΜΙΑΣ',
      department: 'Χειρουργείο',
      specialty: 'Γενική',
      expected: 4,
      compositionTemplate: [
        {code: 'BH110R', name: 'ΛΑΒΙΔΑ KOCHER', quantity: 3},
        {code: 'BC260R', name: 'ΨΑΛΙΔΙ METZENBAUM', quantity: 1},
      ],
    } as SetAsset;
    const tools = [
      {barcode: 'T1', name: 'ΛΑΒΙΔΑ KOCHER', code: 'bh110r', manufacturer: 'Aesculap'},
      {barcode: 'T2', name: 'ΛΑΒΙΔΑ KOCHER', code: 'BH110R', manufacturer: 'Aesculap'},
    ] as Tool[];
    const html = compositionHtml(set, tools, 'Demo', '29/09/2026', [{barcode: 'S000002', type: 'Έλλειψη'}]);
    expect(html).toContain('Λείπει 1</em>');
    expect(html).toContain('Λείπουν 2 εργαλεία');
    expect(html).toContain('Εκκρεμότητα Σετ: Έλλειψη');
    expect(html).toContain('class="missing"');
  });
});

describe('label paper', () => {
  it('uses the printer roll size, keeps room on the right and splits 1 + 2', () => {
    const html = barcodeLabelHtml(
      {barcode: 'S000001', name: 'ΒΑΣΙΚΟ', department: 'Χειρουργείο', code: '041993'},
      'SET',
      12,
      {
        size: 'SHEET',
        header: 'BRAND',
        showDetails: false,
        showCode: true,
        width: 105,
        height: 55,
        reserveRight: 6,
        mainShare: 60,
      },
    );
    expect(html).toContain('size:105mm 55mm');
    expect(html).toContain('grid-template-rows:33mm 22mm');
    expect(html).toContain('8.0mm 1.1mm 2mm');
    expect(html).toContain('cod. 041993');
    // The code line is on the large label only.
    expect(html.match(/cod\. 041993/g)).toHaveLength(1);
  });
});

describe('sterile label', () => {
  it('puts the remaining uses on the left and both dates side by side on the right', () => {
    const html = barcodeLabelHtml({...tool, sterileUntil: '2027-02-04', shelfLifeMonths: 6}, 'TOOL', undefined, {
      size: 'SMALL',
      header: 'BRAND',
      showDetails: true,
    });
    expect(html).toContain('<span class="left">Υπόλ. χρήσεων: 27</span><span class="dates">');
    expect(html).toContain('04/08/26');
    expect(html).toContain('04/02/27');
  });
});
