import {describe, expect, it, vi} from 'vitest';
import {watchSessionLoss} from '../sessionLoss';

const KEY = 'sb_publishable_test';
const reply = (status: number) => vi.fn(async () => new Response('{}', {status})) as unknown as typeof fetch;
const anon = {headers: {Authorization: `Bearer ${KEY}`}};

describe('watchSessionLoss', () => {
  it('reports once when a table answers 401 to a request without a user', async () => {
    const onLost = vi.fn();
    const watched = watchSessionLoss(reply(401), KEY, onLost);
    await watched('https://x.supabase.co/rest/v1/equipment_status?select=name', anon);
    await watched('https://x.supabase.co/rest/v1/instruments', anon);
    expect(onLost).toHaveBeenCalledTimes(1);
  });

  it('leaves a signed-in user, other answers and other services alone', async () => {
    const onLost = vi.fn();
    await watchSessionLoss(
      reply(401),
      KEY,
      onLost,
    )('https://x.supabase.co/rest/v1/instruments', {
      headers: {Authorization: 'Bearer eyJ.user.token'},
    });
    await watchSessionLoss(reply(200), KEY, onLost)('https://x.supabase.co/rest/v1/instruments', anon);
    await watchSessionLoss(reply(401), KEY, onLost)('https://x.supabase.co/auth/v1/token', anon);
    expect(onLost).not.toHaveBeenCalled();
  });

  it('passes the answer through unchanged', async () => {
    const response = await watchSessionLoss(reply(401), KEY, () => undefined)('https://x/rest/v1/t', anon);
    expect(response.status).toBe(401);
  });
});
