import {afterEach, describe, expect, it, vi} from 'vitest';

vi.mock('../../data/cloud/identity', () => ({getRealIdentity: () => ({platform: true, role: 'ADMIN'})}));

describe('the owner viewing a hospital as its administrator', () => {
  afterEach(() => sessionStorage.clear());
  it('is the owner when working as themselves, not when viewing as a role', async () => {
    const {isPlatformOwner} = await import('../platformOnly');
    expect(isPlatformOwner()).toBe(true);
    sessionStorage.setItem('surgitrack-session-user', JSON.stringify({id: 'o', role: 'ADMIN', viewAs: true}));
    expect(isPlatformOwner()).toBe(false);
  });
});
