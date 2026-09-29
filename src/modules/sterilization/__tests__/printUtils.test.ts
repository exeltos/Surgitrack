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
    const html = compositionHtml(set, tools, 'Demo', '29/09/2026', ['T3'], {
      marker: [{name: 'Μπλε', colors: ['#1f5fbf']}],
    });
    expect(html).toContain('<td class="qty">2</td>');
    expect(html).toContain('<td>—</td>');
    expect(html).toContain('class="issue"');
    expect(html).toContain('Ονοματεπώνυμο & υπογραφή');
    expect(html).toContain('Μπλε');
  });
});
