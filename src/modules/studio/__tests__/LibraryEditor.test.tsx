import {fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import LibraryEditor from '../LibraryEditor';

describe('a sterilizer program removed in Settings', () => {
  it('is removed only after the deletion is confirmed', () => {
    const onSave = vi.fn();
    render(
      <LibraryEditor
        withPrograms
        title="Κλίβανοι"
        item={{id: 'k1', el: 'Κλίβανος Α', en: 'Sterilizer A', programs: ['134°C · 5 min', '121°C · 18 min']}}
        onClose={() => undefined}
        onSave={onSave}
      />,
    );
    const removes = () => screen.getAllByRole('button', {name: 'Αφαίρεση προγράμματος'});
    // Asked first; cancelled, both programs stay.
    fireEvent.click(removes()[0]);
    const asked = screen.getByRole('dialog');
    expect(asked).toHaveTextContent('134°C · 5 min');
    fireEvent.click(within(asked).getByRole('button', {name: 'Ακύρωση'}));
    expect(removes()).toHaveLength(2);
    // Confirmed: it goes, and the sterilizer is saved with the other one.
    fireEvent.click(removes()[0]);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Διαγραφή'}));
    expect(removes()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', {name: 'Αποθήκευση'}));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({programs: ['121°C · 18 min']}));
  });
});
