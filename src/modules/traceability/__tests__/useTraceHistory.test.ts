import {describe, expect, it} from 'vitest';
import {traceFilters} from '../useTraceHistory';

describe('what Traceability asks of the older history', () => {
  it('an item: its moves by barcode (old ones too, and its Set) and its cycles', () => {
    const filters = traceFilters({
      assetIds: ['t9', 's1'],
      barcodes: ['T000009', 'OLD-9', 'S000001'],
      patientBarcodes: [],
    });
    expect(filters).toEqual({
      movements: 'asset.ilike."T000009*",asset.ilike."OLD-9*",asset.ilike."S000001*"',
      sterilizationCycles:
        'asset_id.in.("t9","s1"),barcode.in.("T000009","OLD-9","S000001"),tool_ids.cs.{"t9"},tool_ids.cs.{"s1"}',
    });
  });

  it('a patient code or other text: moves and counts that contain it, then the cycles of what the moves name', () => {
    expect(traceFilters({assetIds: [], barcodes: [], text: ' P-77 ', patientBarcodes: ['S000002']})).toEqual({
      movements: 'asset.ilike."*P-77*",patient_code.ilike."*P-77*",status.ilike."*P-77*"',
      counts: 'patient_code.ilike."*P-77*"',
      sterilizationCycles: 'barcode.in.("S000002")',
    });
  });

  it('keeps commas, quotes and wildcards typed in the search as text', () => {
    const {movements} = traceFilters({assetIds: [], barcodes: [], text: 'a,"b"*', patientBarcodes: []});
    expect(movements?.split('",')[0]).toBe('asset.ilike."*a,\\"b\\"*');
  });

  it('asks nothing for an empty search', () => {
    expect(traceFilters({assetIds: [], barcodes: [], text: '  ', patientBarcodes: []})).toEqual({});
  });
});
