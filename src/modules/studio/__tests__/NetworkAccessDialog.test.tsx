import {describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {Organization} from '../../../core/LibraryStore';

const mocks = vi.hoisted(() => ({rpc: vi.fn()}));

vi.mock('../../../lib/supabase', () => {
  const answer = (table: string) => {
    const data =
      table === 'ip_access'
        ? {mode: 'ENFORCE', addresses: [{ip: '94.64.59.134/32', label: 'Wi-Fi'}], exempt_users: ['u2']}
        : table === 'profiles'
          ? [
              {id: 'u1', name: 'ΑΝΝΑ', role: 'DEPARTMENT', active: true},
              {id: 'u2', name: 'ΝΙΚΟΣ', role: 'VIEWER', active: true},
            ]
          : [];
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => Promise.resolve({data, error: null}),
      maybeSingle: () => Promise.resolve({data, error: null}),
      then: (resolve: (v: unknown) => unknown) => resolve({data, error: null}),
    };
    return chain;
  };
  return {supabase: {from: answer, rpc: mocks.rpc}};
});

const {default: NetworkAccessDialog} = await import('../NetworkAccessDialog');
const {plainAddress: plain} = await import('../../../core/ipAddress');

const org = {id: 'org-1', name: 'ΙΑΣΩ'} as Organization;

describe('the network rule of a hospital', () => {
  it('opens locked, shows an address without its /32, and unlocks with «Επεξεργασία»', async () => {
    mocks.rpc.mockResolvedValue({data: {mode: 'OFF', allowed: true, ip: '109.242.139.232'}, error: null});
    render(<NetworkAccessDialog organization={org} onClose={() => undefined} />);
    const address = (await screen.findByDisplayValue('94.64.59.134')) as HTMLInputElement;
    expect(address.disabled).toBe(true);
    expect(screen.queryByDisplayValue('94.64.59.134/32')).not.toBeInTheDocument();
    // Locked, only the people exempted are listed.
    expect(screen.getByText('ΝΙΚΟΣ')).toBeInTheDocument();
    expect(screen.queryByText('ΑΝΝΑ')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Αποθήκευση'})).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Επεξεργασία'}));
    await waitFor(() => expect((screen.getByDisplayValue('94.64.59.134') as HTMLInputElement).disabled).toBe(false));
    expect(screen.getByText('ΑΝΝΑ')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Αποθήκευση'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /Προσθήκη της IP μου \(109\.242\.139\.232\)/})).toBeInTheDocument();
  });
});

describe('how an address is shown', () => {
  it('drops the prefix of a single address only, never the one of a range', () => {
    expect(plain('94.64.59.134/32')).toBe('94.64.59.134');
    expect(plain('2001:db8::1/128')).toBe('2001:db8::1');
    expect(plain('2001:db8::/32')).toBe('2001:db8::/32');
    expect(plain('203.0.113.0/28')).toBe('203.0.113.0/28');
  });
});
