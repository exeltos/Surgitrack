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

describe('how a sterilizer cycle ends', () => {
  const editor = (onSave = vi.fn(), programs = ['134°C · 5 min · σύνολο 45 min']) =>
    render(
      <LibraryEditor
        withPrograms
        title="Κλίβανοι"
        item={{id: 'k1', el: 'Κλίβανος Α', en: 'Sterilizer A', programs}}
        onClose={() => undefined}
        onSave={onSave}
      />,
    );

  it('starts as automatic for a sterilizer whose programs give their length, and saves the choice', () => {
    const onSave = vi.fn();
    editor(onSave);
    expect(screen.getByRole('radio', {name: /Αυτόματα/})).toBeChecked();
    fireEvent.click(screen.getByRole('radio', {name: /Χειροκίνητα/}));
    fireEvent.click(screen.getByRole('button', {name: 'Αποθήκευση'}));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({cycleEnd: 'MANUAL'}));
  });

  it('asks for every program’s whole length before ending by itself', () => {
    editor(vi.fn(), ['134°C · 5 min']);
    expect(screen.getByRole('radio', {name: /Χειροκίνητα/})).toBeChecked();
    fireEvent.click(screen.getByRole('radio', {name: /Αυτόματα/}));
    expect(screen.getByRole('alert')).toHaveTextContent('Όλος ο κύκλος');
    expect(screen.getByRole('button', {name: 'Αποθήκευση'})).toBeDisabled();
  });
});
