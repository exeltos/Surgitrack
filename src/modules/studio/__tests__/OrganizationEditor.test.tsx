import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import OrganizationEditor from '../OrganizationEditor';
import type {Organization} from '../../../core/LibraryStore';

describe('the hospital editor’s modules', () => {
  it('starts a new hospital with none, and saves the ones the owner picks', () => {
    const onSave = vi.fn();
    render(<OrganizationEditor onClose={() => undefined} onSave={onSave} />);
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    expect(boxes.every(box => !(box as HTMLInputElement).checked)).toBe(true);
    fireEvent.change(screen.getAllByRole('textbox')[0], {target: {value: 'Νέο Νοσοκομείο'}});
    fireEvent.change(screen.getByRole('textbox', {name: 'Ονοματεπώνυμο'}), {target: {value: 'Άννα Διαχειρίστρια'}});
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'anna@example.gr'}});
    fireEvent.click(screen.getByRole('checkbox', {name: /Ελάχιστα αποθέματα/}));
    fireEvent.click(screen.getByRole('button', {name: 'Δημιουργία και πρόσκληση'}));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({name: 'Νέο Νοσοκομείο', modules: ['STOCK_MINIMUMS']});
  });

  it('shows the modules an existing hospital has, and saves the change', () => {
    const onSave = vi.fn();
    const hospital: Organization = {
      id: 'h1',
      name: 'ΙΑΣΩ Θεσσαλίας',
      code: 'IASO',
      active: true,
      demoEnabled: false,
      modules: ['REPLACEMENTS'],
    };
    render(<OrganizationEditor organization={hospital} onClose={() => undefined} onSave={onSave} />);
    expect((screen.getByRole('checkbox', {name: /Αντικαταστάσεις/}) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('checkbox', {name: /Ελάχιστα αποθέματα/}) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole('checkbox', {name: /Αντικαταστάσεις/}));
    fireEvent.click(screen.getByRole('button', {name: 'Αποθήκευση'}));
    expect(onSave.mock.calls[0][0]).toMatchObject({modules: []});
  });
});
