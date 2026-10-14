import {afterEach, describe, expect, it} from 'vitest';
import {demoSigned} from '../handover';

describe('demoSigned', () => {
  afterEach(() => sessionStorage.clear());

  it('confirms a handover a Demo sample person signed', () => {
    sessionStorage.setItem('surgitrack-data-mode', 'DEMO');
    expect(demoSigned('demo-st1001')).toBe(true);
  });

  it('leaves the stamp to the database for anyone else or a server signature', () => {
    sessionStorage.setItem('surgitrack-data-mode', 'DEMO');
    expect(demoSigned('a-real-user')).toBeUndefined();
    expect(demoSigned('demo-st1001', '00000000-0000-4000-8000-000000000001')).toBeUndefined();
    expect(demoSigned(undefined)).toBeUndefined();
  });
});
