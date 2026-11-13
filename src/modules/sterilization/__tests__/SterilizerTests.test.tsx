import {describe, expect, it} from 'vitest';
import {fireEvent, screen, within} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import SterilizerTests from '../parts/SterilizerTests';
import type {SessionUser} from '../../../store/types';

const staff: SessionUser = {id: 'u-ster', name: 'Δοκιμή', role: 'STERILIZATION', department: 'Κεντρική Αποστείρωση'};
/** The row of a sterilizer. */
const row = async (name: string) => (await screen.findByText(name)).closest('li') as HTMLElement;
/** Opens the card from the slim line over the list (nothing recorded yet, so it does not come up by itself). */
const openCard = async (title: RegExp) => fireEvent.click(await screen.findByRole('button', {name: title}));

describe('the tests of the sterilizers in the Loading stage', () => {
  it('lists each sterilizer with its three tests, and records one with its result', async () => {
    renderPage(<SterilizerTests />, {signedIn: staff, demo: true});
    await openCard(/Δοκιμές κλιβάνων/);
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
    await openCard(/Δοκιμές κλιβάνων/);
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

  it("has the washers' own tests in the Cleaning stage, and a failed one is shown red", async () => {
    renderPage(<SterilizerTests equipment="washers" />, {signedIn: staff, demo: true});
    await openCard(/Δοκιμές πλυντηρίων/);
    const region = await screen.findByRole('dialog', {name: 'Δοκιμές πλυντηρίων'});
    const first = within(region).getAllByRole('listitem')[0];
    expect(within(first).getByRole('button', {name: /Έλεγχος καθαρισμού/})).toBeInTheDocument();
    expect(within(first).getByRole('button', {name: /πρωτεΐνης/})).toBeInTheDocument();
    expect(within(first).getByRole('button', {name: /Ψεκαστήρες/})).toBeInTheDocument();
    expect(within(first).queryByRole('button', {name: /Bowie-Dick/})).toBeNull();
    fireEvent.click(within(first).getByRole('button', {name: /Έλεγχος καθαρισμού/}));
    const dialog = await screen.findByRole('dialog', {name: 'Καταγραφή δοκιμής'});
    fireEvent.click(within(dialog).getByRole('radio', {name: 'Αποτυχία'}));
    fireEvent.click(within(dialog).getByRole('button', {name: 'Καταγραφή'}));
    expect(await screen.findByRole('status')).toHaveTextContent('το πλυντήριο');
    expect(within(first).getByRole('button', {name: /Έλεγχος καθαρισμού/})).toHaveClass('bad');
  });

  it('comes up in front when a test is due, closes with «Αργότερα» and opens again from the line', async () => {
    window.localStorage.clear();
    renderPage(<SterilizerTests />, {signedIn: staff, demo: true});
    await openCard(/Δοκιμές κλιβάνων/);
    // One test recorded: the others are now due, and the card says so.
    fireEvent.click(within(await row('Κλίβανος Ατμού 01')).getByRole('button', {name: /Bowie-Dick/}));
    fireEvent.click(
      within(await screen.findByRole('dialog', {name: 'Καταγραφή δοκιμής'})).getByRole('button', {name: 'Καταγραφή'}),
    );
    const card = await screen.findByRole('dialog', {name: 'Δοκιμές κλιβάνων'});
    expect(await within(card).findByText(/με εκκρεμή δοκιμή/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', {name: 'Αργότερα'}));
    expect(screen.queryByRole('dialog', {name: 'Δοκιμές κλιβάνων'})).toBeNull();
    // The line over the list still shows it, and brings the card back.
    fireEvent.click(screen.getByRole('button', {name: /Δοκιμές κλιβάνων.*εκκρεμή/}));
    expect(await screen.findByRole('dialog', {name: 'Δοκιμές κλιβάνων'})).toBeInTheDocument();
  });
});
