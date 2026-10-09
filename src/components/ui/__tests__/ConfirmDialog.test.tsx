import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  it('confirms at once when nothing has to be typed', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog title="Τ" message="Μ" onConfirm={onConfirm} onClose={() => undefined} />);
    await userEvent.setup().click(screen.getByRole('button', {name: 'Επιβεβαίωση'}));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('waits for the exact name before something that cannot be undone', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmDialog
        title="Διαγραφή νοσοκομείου"
        message="Δεν αναιρείται."
        confirmLabel="Οριστική διαγραφή"
        danger
        confirmText="TEST Hospital"
        onConfirm={onConfirm}
        onClose={() => undefined}
      />,
    );
    const button = screen.getByRole('button', {name: 'Οριστική διαγραφή'});
    const input = screen.getByLabelText('Για επιβεβαίωση, πληκτρολογήστε «TEST Hospital»');
    expect(button).toBeDisabled();
    await user.type(input, 'TEST');
    expect(button).toBeDisabled();
    await user.type(input, ' Hospital');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
