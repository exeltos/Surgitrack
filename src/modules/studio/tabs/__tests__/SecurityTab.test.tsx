import {describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {StudioPageState} from '../../useStudioPage';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  confirm: vi.fn(),
  sessions: [] as unknown[],
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    auth: {getSession: () => Promise.resolve({data: {session: {user: {id: 'owner'}}}})},
    rpc: (name: string, args?: unknown) => {
      mocks.rpc(name, args);
      return Promise.resolve({data: name === 'platform_active_sessions' ? mocks.sessions : null, error: null});
    },
    from: () => ({
      select: () => ({
        order: () =>
          Promise.resolve({
            data: [{ip: '198.51.100.7/32', note: 'tried too often', blocked_at: '2026-11-10T09:00:00Z'}],
            error: null,
          }),
        eq: () => ({maybeSingle: () => Promise.resolve({data: {demo_enabled: false}, error: null})}),
      }),
    }),
  },
}));
vi.mock('../../../../components/ui/confirmService', () => ({askConfirm: mocks.confirm}));

const {default: SecurityTab} = await import('../SecurityTab');

const state = {L: (el: string) => el, platformAdmin: true, tab: 'SECURITY'} as unknown as StudioPageState;
const session = (over: object) => ({
  user_id: 'u1',
  name: 'Μαρία',
  email: 'maria@example.com',
  role: 'STERILIZATION',
  organization_id: 'o1',
  organization_name: 'Γενικό',
  active: true,
  ip: '203.0.113.5',
  ip_blocked: false,
  user_agent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130.0 Safari/537.36',
  first_seen: '2026-11-10T08:00:00Z',
  last_seen: new Date().toISOString(),
  ...over,
});

describe('the owner’s security section', () => {
  it('lists who is connected with their address, and blocks the address after a confirmation', async () => {
    mocks.sessions = [session({}), session({user_id: 'u2', name: 'Νίκος', email: 'n@example.com'})];
    mocks.confirm.mockResolvedValue(true);
    render(<SecurityTab s={state} />);
    expect(await screen.findByText('Μαρία')).toBeInTheDocument();
    expect(screen.getAllByText('203.0.113.5')).toHaveLength(2);
    expect(screen.getAllByText('2 άτομα')).toHaveLength(2);
    expect(screen.getByText('198.51.100.7')).toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', {name: /Μπλοκάρισμα IP/})[0]);
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({message: expect.stringContaining('2 άτομα')}));
    await waitFor(() =>
      expect(mocks.rpc).toHaveBeenCalledWith('platform_block_ip', {p_ip: '203.0.113.5', p_note: null}),
    );
  });

  it('blocks nothing when the confirmation is declined, and unblocks a blocked address', async () => {
    mocks.sessions = [session({})];
    mocks.rpc.mockClear();
    mocks.confirm.mockResolvedValue(false);
    render(<SecurityTab s={state} />);
    await userEvent.click((await screen.findAllByRole('button', {name: /Μπλοκάρισμα IP/}))[0]);
    expect(mocks.rpc).not.toHaveBeenCalledWith('platform_block_ip', expect.anything());
    await userEvent.click(screen.getByRole('button', {name: 'Ξεμπλοκάρισμα'}));
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('platform_unblock_ip', {p_ip: '198.51.100.7/32'}));
  });

  it('offers no block on the owner’s own row, nor on a row of the platform', async () => {
    mocks.sessions = [
      session({user_id: 'owner', name: 'Platform Admin', organization_id: null, organization_name: null}),
    ];
    render(<SecurityTab s={state} />);
    expect(await screen.findByText('Platform Admin')).toBeInTheDocument();
    expect(await screen.findByText('Εσείς')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Μπλοκάρισμα IP/})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Αναστολή χρήστη/})).not.toBeInTheDocument();
  });

  it('shows nothing to anyone but the platform owner', () => {
    const {container} = render(<SecurityTab s={{...state, platformAdmin: false}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
