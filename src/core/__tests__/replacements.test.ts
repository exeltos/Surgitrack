import {describe, expect, it} from 'vitest';
import {addOrderLine, allocateStock, orderLineFromTool, orderLines, replacementItems, toolKinds} from '../replacements';
import type {Issue, Movement, PurchaseOrder, SetAsset, Tool} from '../../types/domain';

const tool = (id: string, patch: Partial<Tool> = {}): Tool => ({
  id,
  barcode: `T${id}`,
  code: 'BH110R',
  name: 'ΛΑΒΙΔΑ KOCHER',
  specialty: '',
  mode: 'SET_MEMBER',
  state: 'IN_DEPARTMENT',
  uses: 0,
  sterilizations: 0,
  ...patch,
});
const set = {id: 's1', barcode: 'S1', name: 'ΒΑΣΙΚΟ', department: 'Χειρουργείο'} as SetAsset;
const issue = (barcode: string, type: string): Issue => ({
  id: `i-${barcode}`,
  asset: `${barcode} · X`,
  type,
  status: 'OPEN',
  created: '01/10/2026',
  department: 'Χειρουργείο',
  note: '',
});

const data = (tools: Tool[], extra: {issues?: Issue[]; movements?: Movement[]; orders?: PurchaseOrder[]} = {}) =>
  replacementItems({
    tools,
    retiredTools: [],
    sets: [set],
    issues: extra.issues || [],
    movements: extra.movements || [],
    purchaseOrders: extra.orders || [],
  });

describe('replacementItems', () => {
  it('lists damaged, serviced and lost instruments with the Stock that matches', () => {
    const items = data(
      [
        tool('1', {setId: 's1'}),
        tool('2', {state: 'SERVICE', mode: 'STANDALONE', department: 'Service'}),
        tool('3', {mode: 'STOCK', state: 'IN_STOCK', code: 'bh110r'}),
        tool('4', {setId: 's1', code: 'OTHER'}),
      ],
      {
        issues: [issue('T1', 'Βλάβη')],
        movements: [
          {
            id: 'm',
            asset: 'T2 · X',
            assetKind: 'TOOL',
            from: 'Set S1',
            to: 'Χαλασμένα / Service',
            status: '',
            at: '',
            by: '',
          },
        ],
      },
    );
    expect(items.map(i => [i.tool.id, i.reason, i.set?.id, i.stock.map(s => s.id)])).toEqual([
      ['1', 'DAMAGED', 's1', ['3']],
      ['2', 'SERVICE', 's1', ['3']],
    ]);
  });

  it('marks instruments already in an order or already replaced', () => {
    const order = {id: 'po', number: 'ΠΑ-1', status: 'OPEN', lines: [{toolIds: ['1']}]} as unknown as PurchaseOrder;
    const items = data(
      [tool('1', {state: 'LOST', mode: 'STANDALONE'}), tool('2', {state: 'SERVICE', replacedBy: 'T9'})],
      {
        orders: [order],
      },
    );
    expect(items.find(i => i.tool.id === '1')?.status).toBe('IN_ORDER');
    expect(items.find(i => i.tool.id === '2')?.status).toBe('REPLACED');
  });
});

describe('allocateStock and orderLines', () => {
  it('never gives the same Stock instrument twice and groups order lines by kind', () => {
    const items = data(
      [tool('1', {setId: 's1'}), tool('2', {setId: 's1'}), tool('3', {mode: 'STOCK', state: 'IN_STOCK'})],
      {issues: [issue('T1', 'Βλάβη'), issue('T2', 'Φθορά')]},
    );
    expect(allocateStock(items)).toEqual([{toolId: '1', stockToolId: '3', setId: 's1'}]);
    expect(orderLines(items)).toEqual([
      {
        code: 'BH110R',
        name: 'ΛΑΒΙΔΑ KOCHER',
        manufacturer: undefined,
        quantity: 2,
        reason: 'Βλάβη / φθορά',
        toolIds: ['1', '2'],
        barcodes: ['T1', 'T2'],
      },
    ]);
  });
});

describe('ordering from anywhere', () => {
  it('turns any instrument into an order line, even one that needs no replacement', () => {
    const t = tool('1', {state: 'IN_STOCK', mode: 'STOCK', manufacturer: 'Aesculap'});
    expect(orderLineFromTool(t, 'Έλλειψη')).toEqual({
      code: 'BH110R',
      name: 'ΛΑΒΙΔΑ KOCHER',
      manufacturer: 'Aesculap',
      quantity: 1,
      reason: 'Έλλειψη',
      toolIds: ['1'],
      barcodes: ['T1'],
    });
  });

  it('adds the same kind to its line and a new kind as a new line', () => {
    const a = orderLineFromTool(tool('1'), 'Βλάβη');
    const b = orderLineFromTool(tool('2'), 'Απώλεια');
    const c = {code: '', name: 'ΝΕΟ ΕΡΓΑΛΕΙΟ', quantity: 3, toolIds: [], barcodes: []};
    const lines = addOrderLine(addOrderLine(addOrderLine([], a), b), c);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      quantity: 2,
      reason: 'Βλάβη, Απώλεια',
      toolIds: ['1', '2'],
      barcodes: ['T1', 'T2'],
    });
    expect(lines[1].quantity).toBe(3);
  });

  it('lists each kind once', () => {
    expect(toolKinds([tool('1'), tool('2'), tool('3', {code: 'X', name: 'ΑΛΛΟ'})]).map(t => t.id)).toEqual(['3', '1']);
  });
});
