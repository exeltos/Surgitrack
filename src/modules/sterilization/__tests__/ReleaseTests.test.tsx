import {describe, expect, it} from 'vitest';
import {fireEvent, screen, within} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import ReleaseTests from '../parts/ReleaseTests';
import type {SessionUser} from '../../../store/types';

const staff: SessionUser = {id: 'u-ster', name: 'Δοκιμή', role: 'STERILIZATION', department: 'Κεντρική Αποστείρωση'};

describe('the tests of the sterilizer in the release of a load', () => {
  it("shows the sterilizer's tests, and a failed one stops the release", async () => {
    renderPage(<ReleaseTests equipment="Κλίβανος Ατμού 01" />, {signedIn: staff, demo: true});
    const region = await screen.findByRole('region', {name: 'Δοκιμές κλιβάνου'});
    expect(within(region).getByText('Κλίβανος Ατμού 01')).toBeInTheDocument();
    // None recorded yet: only a hint.
    expect(region).toHaveTextContent('Δεν έχουν καταγραφεί δοκιμές');
    fireEvent.click(within(region).getByRole('button', {name: /Bowie-Dick/}));
    const dialog = await screen.findByRole('dialog', {name: 'Καταγραφή δοκιμής'});
    fireEvent.click(within(dialog).getByRole('radio', {name: 'Αποτυχία'}));
    fireEvent.click(within(dialog).getByRole('button', {name: 'Καταγραφή'}));
    expect(await screen.findByRole('alert')).toHaveTextContent('το φορτίο δεν αποδεσμεύεται');
  });

  it("shows nothing for equipment that is not in the hospital's list", async () => {
    renderPage(<ReleaseTests equipment="Άγνωστος" />, {signedIn: staff, demo: true});
    expect(screen.queryByRole('region', {name: 'Δοκιμές κλιβάνου'})).toBeNull();
  });
});
