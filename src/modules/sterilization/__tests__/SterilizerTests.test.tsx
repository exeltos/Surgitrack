import {describe, expect, it} from 'vitest';
import {fireEvent, screen, within} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import SterilizerTests from '../parts/SterilizerTests';
import type {SessionUser} from '../../../store/types';

const staff: SessionUser = {id: 'u-ster', name: 'Δοκιμή', role: 'STERILIZATION', department: 'Κεντρική Αποστείρωση'};
/** The row of a sterilizer. */
const row = async (name: string) => (await screen.findByText(name)).closest('li') as HTMLElement;

describe('the tests of the sterilizers in the Loading stage', () => {
  it('lists each sterilizer with its three tests, and records one with its result', async () => {
    renderPage(<SterilizerTests />, {signedIn: staff, demo: true});
    const first = await row('Κλίβανος Ατμού 01');
    expect(within(first).getByRole('button', {name: /Bowie-Dick/})).toBeInTheDocument();
    expect(within(first).getByRole('button', {name: /διαρροής κενού/})).toBeInTheDocument();
    expect(within(first).getByRole('button', {name: /Βιολογική/})).toBeInTheDocument();
    fireEvent.click(within(first).getByRole('button', {name: /Bowie-Dick/}));
    const dialog = await screen.findByRole('dialog', {name: 'Καταγραφή δοκιμής'});
    fireEvent.click(within(dialog).getByRole('radio', {name: 'Αποτυχία'}));
    fireEvent.click(within(dialog).getByRole('button', {name: 'Καταγραφή'}));
    // It says so, and the button is now red: the sterilizer is not loaded.
    expect(await screen.findByRole('status')).toHaveTextContent('δεν φορτώνεται');
    const again = await row('Κλίβανος Ατμού 01');
    expect(within(again).getByRole('button', {name: /Bowie-Dick/})).toHaveClass('bad');
    // The other sterilizer is not affected.
    const second = await row('Κλίβανος Ατμού 02');
    expect(within(second).getByRole('button', {name: /Bowie-Dick/})).not.toHaveClass('bad');
  });

  it('marks a test as due only once the hospital records tests at all', async () => {
    renderPage(<SterilizerTests />, {signedIn: staff, demo: true});
    const first = await row('Κλίβανος Ατμού 01');
    // Nothing was ever recorded: no nagging yet.
    expect(within(first).getByRole('button', {name: /Bowie-Dick/})).toHaveClass('none');
    fireEvent.click(within(first).getByRole('button', {name: /Bowie-Dick/}));
    const dialog = await screen.findByRole('dialog', {name: 'Καταγραφή δοκιμής'});
    fireEvent.click(within(dialog).getByRole('button', {name: 'Καταγραφή'}));
    // Now it is in use: the other tests of every sterilizer are due.
    const second = await row('Κλίβανος Ατμού 02');
    expect(await within(second).findByRole('button', {name: /Βιολογική/})).toHaveClass('due');
    expect(within(await row('Κλίβανος Ατμού 01')).getByRole('button', {name: /Bowie-Dick/})).toHaveClass('ok');
  });
});
