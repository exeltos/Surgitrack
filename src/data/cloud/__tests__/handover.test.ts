import {describe, expect, it} from 'vitest';
import {verifyHandover} from '../handover';

describe('handover signature (demo)', () => {
  it('signs a demo department person by user code', async () => {
    const result = await verifyHandover(' ok1210 ', 'demo');
    expect(result).toMatchObject({ok: true, signer: {code: 'OK1210', department: 'Ορθοπεδική Κλινική'}});
  });
  it('refuses an unknown code or an empty password', async () => {
    expect(await verifyHandover('XX0000', 'demo')).toEqual({ok: false, reason: 'invalid'});
    expect(await verifyHandover('OK1210', '')).toEqual({ok: false, reason: 'invalid'});
  });
});
