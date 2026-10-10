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
  markDemoRequestHandled: vi.fn(),
  setDemoAutoDelete: vi.fn(),
  convertDemoAccount: vi.fn(),
  deleteDemoAccount: vi.fn(),
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
  autoDelete: true,
  endsAt: inDays(10),
  active: true,
  seededAt: inDays(-1),
  invitedAt: inDays(-1),
  createdAt: inDays(-1),
  evaluatorActive: false,
  extraUsers: 0,
  colleagues: [],
  ratings: [],
  evaluations: [],
  requests: [],
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

  it('opens a Demo with the screen guides off when chosen, and fills it so', async () => {
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: /Νέο Demo/}));
    const form = screen.getByRole('complementary', {name: 'Νέο Demo αξιολόγησης'});
    const guides = within(form).getByLabelText(/^Οδηγοί οθόνης/) as HTMLSelectElement;
    // On unless chosen otherwise.
    expect(guides.value).toBe('ON');
    await user.type(within(form).getByLabelText('Νοσοκομείο'), 'Γ.Ν. Λάρισας');
    await user.type(within(form).getByLabelText('Ονοματεπώνυμο'), 'Μαρία Παππά');
    await user.type(within(form).getByLabelText('Email'), 'maria@hospital.gr');
    await user.selectOptions(guides, 'OFF');
    await user.click(within(form).getByRole('button', {name: 'Δημιουργία και αποστολή'}));
    await screen.findByText(/το email στάλθηκε/);
    expect(service.createDemoAccount.mock.calls[0][0]).toMatchObject({screenGuides: false});
    expect(service.seedDemoAccount.mock.calls[0][3]).toBe(false);
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
          {
            id: 'c1',
            name: 'ΝΙΚΟΣ ΡΗΓΑΣ',
            email: 'n@h.gr',
            role: 'STERILIZATION',
            active: true,
            userCode: 'NR1111',
            guide: {done: 3, total: 7},
          },
        ],
      }),
    ]);
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: '1 / 5'}));
    expect(screen.getByText('ΝΙΚΟΣ ΡΗΓΑΣ')).toBeInTheDocument();
    expect(screen.getByText('NR1111')).toBeInTheDocument();
    expect(screen.getByText('Βήματα 3/7')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Όριο συναδέλφων'), '8');
    await waitFor(() => expect(service.setDemoUserLimit).toHaveBeenCalledWith('demo-1', 8));
  });

  it('shows what the Demo thinks of SurgiTrack and handles its requests', async () => {
    service.loadDemoAccounts.mockResolvedValue([
      demo({
        ratings: [
          {topic: 'sterilization', average: 4.5, count: 2, comments: []},
          {topic: 'step_receive', average: 3, count: 1, comments: ['Θέλω σάρωση από κινητό']},
        ],
        evaluations: [{name: 'ΜΑΡΙΑ ΠΑΠΠΑ', nps: 9, ease: 4, fit: 5, missing: 'Σύνδεση με ERP', sets: 400}],
        requests: [
          {
            id: 'req-1',
            kind: 'PURCHASE',
            name: 'Μαρία Παππά',
            phone: '2410 000000',
            message: 'Καλέστε με',
            status: 'NEW',
            createdAt: inDays(0),
          },
          {id: 'req-0', kind: 'EXTENSION', name: 'Μαρία Παππά', status: 'HANDLED', createdAt: inDays(-2)},
        ],
      }),
    ]);
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    expect(await screen.findByText('Νέα αιτήματα: 1')).toBeInTheDocument();
    expect(screen.getByText('Θέλει την εφαρμογή')).toBeInTheDocument();
    expect(screen.getByText('Καλέστε με')).toBeInTheDocument();
    expect(screen.getByText('Ροή Αποστείρωσης')).toBeInTheDocument();
    expect(screen.getByText('4,5 ★')).toBeInTheDocument();
    // A step's rating, under its part of the app, with its comment.
    expect(screen.getByText('Ροή Αποστείρωσης · Παραλαβή από τμήμα')).toBeInTheDocument();
    expect(screen.getByText('Θέλω σάρωση από κινητό')).toBeInTheDocument();
    expect(screen.getByText('Σύσταση 9/10')).toHaveClass('promoter');
    expect(screen.getByText('Λείπει: Σύνδεση με ERP')).toBeInTheDocument();
    expect(screen.getByText('Σετ 400 · Αίθουσες —')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Διεκπεραιώθηκε'}));
    await waitFor(() => expect(service.markDemoRequestHandled).toHaveBeenCalledWith('req-1'));
  });

  it('shows when an ended Demo is deleted, and keeps it on request', async () => {
    service.loadDemoAccounts.mockResolvedValue([demo({endsAt: '2026-10-01T20:59:59.000Z'})]);
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    const keep = await screen.findByRole('checkbox', {name: 'Αυτόματη διαγραφή 30 ημέρες μετά τη λήξη'});
    expect(keep).toBeChecked();
    expect(screen.getByText('31/10/2026')).toBeInTheDocument();
    await user.click(keep);
    await waitFor(() => expect(service.setDemoAutoDelete).toHaveBeenCalledWith('demo-1', false));
  });

  it('turns a Demo into a customer hospital, with a clean start by default', async () => {
    service.loadDemoAccounts.mockResolvedValue([demo({evaluatorActive: true})]);
    service.convertDemoAccount.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: 'Μετατροπή σε πελάτη'}));
    const form = screen.getByRole('complementary', {name: 'Μετατροπή σε πελάτη'});
    expect(within(form).getByLabelText('Όνομα νοσοκομείου')).toHaveValue('Γ.Ν. Λάρισας');
    expect((within(form).getByLabelText('Κωδικός νοσοκομείου') as HTMLInputElement).value).toMatch(/^GNL-\d{4}$/);
    await user.clear(within(form).getByLabelText('Κωδικός νοσοκομείου'));
    await user.type(within(form).getByLabelText('Κωδικός νοσοκομείου'), 'gnl-1');
    await user.click(within(form).getByRole('button', {name: 'Μετατροπή'}));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('τα δοκιμαστικά δεδομένα διαγράφονται');
    await user.click(within(dialog).getByRole('button', {name: 'Μετατροπή'}));
    await waitFor(() =>
      expect(service.convertDemoAccount).toHaveBeenCalledWith('demo-1', {
        name: 'Γ.Ν. Λάρισας',
        code: 'GNL-1',
        plan: 'STANDARD',
        trialEndsAt: undefined,
        keepData: false,
      }),
    );
    expect(await screen.findByText(/έγινε πελάτης/)).toBeInTheDocument();
  });

  it('says when the hospital code is taken', async () => {
    service.loadDemoAccounts.mockResolvedValue([demo()]);
    service.convertDemoAccount.mockRejectedValue({
      message: 'duplicate key value violates unique constraint "organizations_code_key"',
    });
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: 'Μετατροπή σε πελάτη'}));
    const form = screen.getByRole('complementary', {name: 'Μετατροπή σε πελάτη'});
    await user.click(within(form).getByRole('radio', {name: /Διατήρηση δεδομένων/}));
    await user.click(within(form).getByRole('button', {name: 'Μετατροπή'}));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', {name: 'Μετατροπή'}));
    expect(await screen.findByText('Ο κωδικός νοσοκομείου υπάρχει ήδη.')).toBeInTheDocument();
    expect(service.convertDemoAccount.mock.calls[0][1]).toMatchObject({keepData: true});
  });

  it('shows a converted Demo as a customer, with only "Enter"', async () => {
    service.loadDemoAccounts.mockResolvedValue([demo({status: 'CONVERTED', convertedAt: '2026-10-09T10:00:00Z'})]);
    render(<DemoAccountsPanel />);
    expect(await screen.findAllByText('Έγινε πελάτης')).not.toHaveLength(0);
    expect(screen.getByText('Πελάτης από')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Μετατροπή σε πελάτη'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /Επαναφορά δεδομένων/})).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Είσοδος'})).toBeEnabled();
  });

  it('shows how far the Demos went', async () => {
    service.loadDemoAccounts.mockResolvedValue([
      demo({id: 'a', evaluatorActive: true, evaluations: [{name: 'Μ', nps: 8}]}),
      demo({id: 'b', status: 'PREPARING'}),
    ]);
    render(<DemoAccountsPanel />);
    const funnel = await screen.findByLabelText('Πορεία των Demo');
    expect(within(funnel).getByText('Σύνδεση').parentElement).toHaveTextContent('Σύνδεση150%');
    expect(funnel).toHaveTextContent('Μέση σύσταση: 8,0/10');
  });

  it('deletes a Demo for good after a warning', async () => {
    service.loadDemoAccounts.mockResolvedValue([demo({evaluatorId: 'ev', extraUsers: 2})]);
    service.deleteDemoAccount.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<DemoAccountsPanel />);
    await user.click(await screen.findByRole('button', {name: 'Διαγραφή Demo'}));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('οι λογαριασμοί των 3 χρηστών');
    expect(dialog).toHaveTextContent('Δεν αναιρείται');
    await user.click(within(dialog).getByRole('button', {name: 'Οριστική διαγραφή'}));
    await waitFor(() => expect(service.deleteDemoAccount).toHaveBeenCalledWith('demo-1'));
    expect(await screen.findByText('Το «Γ.Ν. Λάρισας · Demo» διαγράφηκε οριστικά.')).toBeInTheDocument();
  });
});
