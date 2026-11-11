import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MemberDrawer from '../MemberDrawer';
import type {Member} from '../hospitalPeopleMeta';

const member = {
  id: 'u2',
  name: 'ΛΙΝΟΥ ΑΝΑΣΤΑΣΙΑ',
  email: 'anastasia@example.gr',
  role: 'DEPARTMENT',
  department_id: 'd1',
  active: true,
  demo_enabled: false,
  user_code: 'LA8307',
} as unknown as Member;

const L = (el: string) => el;
const drawer = (over: Partial<Parameters<typeof MemberDrawer>[0]> = {}) => {
  const onResetInitial = vi.fn();
  render(
    <MemberDrawer
      member={member}
      self={false}
      departments={[{id: 'd1', name: 'ΜΕΝΝ'} as never]}
      showDemo={false}
      demo={false}
      busy={false}
      L={L}
      lang="el"
      onClose={() => undefined}
      onSave={() => undefined}
      onResend={() => undefined}
      onPasswordReset={() => undefined}
      onResetInitial={onResetInitial}
      onDelete={() => undefined}
      {...over}
    />,
  );
  return onResetInitial;
};

describe('the user’s drawer: a first password from a mobile number', () => {
  it('resets only with a valid number, and hands over exactly what was typed', async () => {
    const reset = drawer();
    const button = screen.getByRole('button', {name: 'Επαναφορά αρχικού κωδικού'});
    expect(button).toBeDisabled();
    const field = screen.getByLabelText('Κινητό (νέος αρχικός κωδικός)');
    await userEvent.type(field, '12');
    expect(button).toBeDisabled();
    await userEvent.clear(field);
    await userEvent.type(field, '+30 691 234 5678');
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(reset).toHaveBeenCalledWith(member, '+30 691 234 5678');
  });

  it('is not offered for one’s own account', () => {
    drawer({self: true});
    expect(screen.queryByLabelText('Κινητό (νέος αρχικός κωδικός)')).not.toBeInTheDocument();
  });

  it('is not offered for an invitation not yet accepted', () => {
    drawer({invitedAt: '2026-11-10T10:00:00Z'});
    expect(screen.queryByLabelText('Κινητό (νέος αρχικός κωδικός)')).not.toBeInTheDocument();
  });
});
