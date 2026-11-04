import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const invoke = vi.fn();
vi.mock('../../../../lib/supabase', () => ({supabase: {functions: {invoke: (...args: unknown[]) => invoke(...args)}}}));
const {default: PasswordReminder} = await import('../PasswordReminder');
type Props = Parameters<typeof PasswordReminder>[0]['s'];

const member = (id: string, extra: Record<string, unknown>) => ({
  id,
  name: id,
  email: `${id}@gmail.com`,
  user_code: id.toUpperCase(),
  role: 'DEPARTMENT',
  active: true,
  password_change_required: true,
  ...extra,
});
const state = (members: unknown[], extra: Record<string, unknown> = {}) => {
  const setNotice = vi.fn();
  const changed = vi.fn(async () => undefined);
  return {
    s: {L: (el: string) => el, members, organizationId: 'org-1', setNotice, changed, ...extra} as unknown as Props,
    setNotice,
    changed,
  };
};

beforeEach(() => invoke.mockReset());

describe('the reminder to those who have not set their own password', () => {
  it('shows nothing when everybody has', () => {
    const {s} = state([member('a1', {password_change_required: false})]);
    const {container} = render(<PasswordReminder s={s} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('counts who is waiting and who cannot be reached, and asks before sending', () => {
    const {s} = state([
      member('a1', {}),
      member('b2', {}),
      member('c3', {email: 'c3@staff.surgitrack.invalid'}),
      member('d4', {password_change_required: false}),
      member('e5', {active: false}),
    ]);
    render(<PasswordReminder s={s} />);
    expect(
      screen.getByText(/3 άτομα δεν έχουν ακόμη ορίσει δικό τους κωδικό \(1 χωρίς προσωπικό email\)/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Αποστολή υπενθύμισης'}));
    expect(screen.getByText('Να σταλεί υπενθύμιση σε 2;')).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('sends the reminder to the reachable ones only, in batches of 25, and says how it went', async () => {
    const people = Array.from({length: 30}, (_, i) => member(`p${i}`, {}));
    invoke.mockImplementation(async (_name: string, options?: {body: {resend: string[]}}) => ({
      data: {sent: (options?.body.resend ?? []).map(user_code => ({user_code, emailed: user_code !== 'P3'}))},
      error: null,
    }));
    const {s, setNotice, changed} = state([...people, member('x', {email: 'x@staff.surgitrack.invalid'})]);
    render(<PasswordReminder s={s} />);
    fireEvent.click(screen.getByRole('button', {name: 'Αποστολή υπενθύμισης'}));
    fireEvent.click(screen.getByRole('button', {name: 'Αποστολή'}));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[0][1].body).toMatchObject({organization_id: 'org-1', reminder: true});
    expect(invoke.mock.calls[0][1].body.resend).toHaveLength(25);
    expect(invoke.mock.calls[1][1].body.resend).toHaveLength(5);
    expect(invoke.mock.calls.flatMap(call => call[1].body.resend)).not.toContain('X');
    expect(setNotice).toHaveBeenCalledWith(
      expect.objectContaining({kind: 'warn', text: expect.stringContaining('29 άτομα')}),
    );
  });
});
