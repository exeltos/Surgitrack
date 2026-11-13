import {describe, expect, it} from 'vitest';
import {HANDOVER_PASS_PREFIX, passFromScan, requestHandoverPass, verifyHandoverPass} from '../handover';

describe('handover QR («Το QR μου»)', () => {
  it('finds the pass in a scanned QR, whatever its case, and nothing in a Set’s barcode', () => {
    expect(passFromScan(`${HANDOVER_PASS_PREFIX}A1B2C3`)).toBe('A1B2C3');
    expect(passFromScan(' surgitrack-pass:a1b2c3 ')).toBe('a1b2c3');
    expect(passFromScan('S000321')).toBeNull();
  });

  it('in the Demo, a department’s QR signs as the Demo person of that department', async () => {
    const pass = await requestHandoverPass('ΜΕΘ');
    expect(pass?.pass).toBe('DEMO:MT1440');
    const result = await verifyHandoverPass(pass!.pass, ['set-1']);
    expect(result).toMatchObject({ok: true, signer: {department: 'ΜΕΘ', code: 'MT1440'}});
  });

  it('in the Demo, refuses a QR that names nobody', async () => {
    expect(await verifyHandoverPass('DEMO:XX0000')).toEqual({ok: false, reason: 'invalid'});
    expect(await verifyHandoverPass('')).toEqual({ok: false, reason: 'invalid'});
  });
});
