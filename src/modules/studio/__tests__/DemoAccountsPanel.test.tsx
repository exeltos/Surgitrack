import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {DemoAccount} from '../../../core/demoAccounts';

const calls: string[] = [];
const service = vi.hoisted(() => ({
  loadDemoAccounts: vi.fn(),
  createDemoAccount: vi.fn(),
  seedDemoAccount: vi.fn(),
  sendDemoInvite: vi.fn(),
  setDemoEnd: vi.fn(),
  setDemoUserLimit: vi.fn(),
  resetDemoAccount: vi.fn(),
}));
vi.mock('../../../data/cloud/demoAccounts', () => service);
vi.mock('../../../data/cloud/hospitalSwitch', () => ({switchHospital: vi.fn()}));

import DemoAccountsPanel from '../demo/DemoAccountsPanel';

const inDays = (days: number) => new Date(Date.now() + days * 864e5).toISOString();
const demo = (patch: Partial<DemoAccount> = {}): DemoAccount => ({
  id: 'demo-1',
  organizationId: 'org-demo',
  organizationName: 'Γ.Ν. Λάρισας · Demo',
  code: 'DEMO-123456',
  hospitalName: 'Γ.Ν. Λάρισας',
  contactName: 'Μαρία Παππά',
  contactEmail: 'maria@hospital.gr',
  status: 'SENT',
  maxExtraUsers: 5,
  endsAt: inDays(10),
  active: true,
  seededAt: inDays(-1),
  invitedAt: inDays(-1),
  createdAt: inDays(-1),
  evaluatorActive: false,
  extraUsers: 0,
  colleagues: [],
  ...patch,
});

beforeEach(() => {
  calls.length = 0;
  Object.values(service).forEach(fn => fn.mockReset());
  service.loadDemoAccounts.mockResolvedValue([]);
  service.createDemoAccount.mockImplementation(async () => {
    calls.push('create');
    return {id: 'demo-new', organization_id: 'org-new', code: 'DEMO-000001'};
  });
  service.seedDemoAccount.mockImplementation(async () => void calls.push('seed'));
  service.sendDemoInvite.mockImplementation(async () => {
    calls.push('invite');
    return {ok: true, user_code: 'MP1234', emailed: true};
  });
});

describe('Studio: evaluation Demos', () => {
  it('opens a Demo: creates it, fills it, and only then sends the email', async () => {
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: /Νέο Demo/}));
    const form = screen.getByRole('complementary', {name: 'Νέο Demo αξιολόγησης'});
    const create = within(form).getByRole('button', {name: 'Δημιουργία και αποστολή'});
    expect(create).toBeDisabled();
    await user.type(within(form).getByLabelText('Νοσοκομείο'), 'Γ.Ν. Λάρισας');
    await user.type(within(form).getByLabelText('Ονοματεπώνυμο'), 'Μαρία Παππά');
    await user.type(within(form).getByLabelText('Email'), 'Maria@Hospital.gr');
    await user.click(create);
    await screen.findByText(/το email στάλθηκε\. Όνομα χρήστη: MP1234/);
    expect(calls).toEqual(['create', 'seed', 'invite']);
    const sent = service.createDemoAccount.mock.calls[0][0];
    expect(sent).toMatchObject({hospitalName: 'Γ.Ν. Λάρισας', contactEmail: 'maria@hospital.gr'});
    // 14 days by default.
    const days = Math.round((Date.parse(sent.endsAt) - Date.now()) / 864e5);
    expect(days).toBeGreaterThanOrEqual(14);
    expect(days).toBeLessThanOrEqual(15);
  });

  it('does not send the email when the sample data fails, and says why', async () => {
    service.seedDemoAccount.mockRejectedValue(new Error('network down'));
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: /Νέο Demo/}));
    const form = screen.getByRole('complementary', {name: 'Νέο Demo αξιολόγησης'});
    await user.type(within(form).getByLabelText('Νοσοκομείο'), 'Γ.Ν. Λάρισας');
    await user.type(within(form).getByLabelText('Ονοματεπώνυμο'), 'Μαρία Παππά');
    await user.type(within(form).getByLabelText('Email'), 'maria@hospital.gr');
    await user.click(within(form).getByRole('button', {name: 'Δημιουργία και αποστολή'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('network down');
    expect(service.sendDemoInvite).not.toHaveBeenCalled();
  });

  it('continues a Demo stopped half-way from where it stopped', async () => {
    service.loadDemoAccounts.mockResolvedValue([
      demo({status: 'PREPARING', seededAt: undefined, invitedAt: undefined}),
    ]);
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: 'Συνέχεια προετοιμασίας'}));
    await waitFor(() => expect(calls).toEqual(['seed', 'invite']));
  });

  it('shows the link to pass on when the email could not be sent', async () => {
    service.loadDemoAccounts.mockResolvedValue([demo({status: 'PREPARING'})]);
    service.sendDemoInvite.mockResolvedValue({
      ok: true,
      user_code: 'MP1234',
      emailed: false,
      url: 'https://x/?st_token=t',
    });
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: 'Αποστολή email'}));
    expect(await screen.findByText(/το email δεν στάλθηκε/)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Αντιγραφή συνδέσμου'})).toBeInTheDocument();
    expect(service.seedDemoAccount).not.toHaveBeenCalled();
  });

  it('shows where each Demo stands', async () => {
    service.loadDemoAccounts.mockResolvedValue([
      demo({id: 'a', hospitalName: 'Α', evaluatorActive: true, evaluatorCode: 'MP1234', extraUsers: 2}),
      demo({id: 'b', hospitalName: 'Β', endsAt: inDays(-2)}),
    ]);
    render(<DemoAccountsPanel />);
    const first = (await screen.findByText('Α')).closest('article')!;
    expect(within(first as HTMLElement).getByText('Σε αξιολόγηση')).toBeInTheDocument();
    expect(within(first as HTMLElement).getByText('2 / 5')).toBeInTheDocument();
    const second = screen.getByText('Β').closest('article')!;
    expect(within(second as HTMLElement).getByText('Έληξε')).toBeInTheDocument();
  });

  it('extends a Demo by a week from its current end', async () => {
    const endsAt = inDays(3);
    service.loadDemoAccounts.mockResolvedValue([demo({endsAt})]);
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: '+7 ημέρες'}));
    await waitFor(() => expect(service.setDemoEnd).toHaveBeenCalled());
    const [org, end] = service.setDemoEnd.mock.calls[0];
    expect(org).toBe('org-demo');
    expect(Date.parse(end) - Date.parse(endsAt)).toBeGreaterThan(6.5 * 864e5);
  });

  it("lists the prospect's colleagues and changes how many they may add", async () => {
    service.loadDemoAccounts.mockResolvedValue([
      demo({
        extraUsers: 1,
        colleagues: [
          {id: 'c1', name: 'ΝΙΚΟΣ ΡΗΓΑΣ', email: 'n@h.gr', role: 'STERILIZATION', active: true, userCode: 'NR1111'},
        ],
      }),
    ]);
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: '1 / 5'}));
    expect(screen.getByText('ΝΙΚΟΣ ΡΗΓΑΣ')).toBeInTheDocument();
    expect(screen.getByText('NR1111')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Όριο συναδέλφων'), '8');
    await waitFor(() => expect(service.setDemoUserLimit).toHaveBeenCalledWith('demo-1', 8));
  });
});
