import {describe, expect, it, vi} from 'vitest';
import {screen} from '@testing-library/react';
import {renderPage} from '../../../test/renderPage';
import HospitalProfile from '../HospitalProfile';

const identity = vi.hoisted(() => ({current: {id: 'u1', platform: false} as {id: string; platform: boolean}}));
vi.mock('../../../data/cloud/identity', () => ({
  getRealIdentity: () => identity.current,
  productionOrganizationFor: () => undefined,
}));

describe('Settings → Hospital', () => {
  it('shows the hospital admin only the hospital’s own details', () => {
    identity.current = {id: 'admin', platform: false};
    renderPage(<HospitalProfile actor="Admin" />, {path: '/studio'});
    expect(screen.getByLabelText('Διεύθυνση')).toBeInTheDocument();
    expect(screen.queryByText('Ενότητες')).not.toBeInTheDocument();
    expect(screen.queryByText('Στάδια αποστείρωσης')).not.toBeInTheDocument();
  });

  it('gives the platform owner the name, use, modules and stages together', async () => {
    identity.current = {id: 'owner', platform: true};
    renderPage(<HospitalProfile actor="Owner" />, {path: '/studio'});
    expect(await screen.findByText('Ενότητες')).toBeInTheDocument();
    expect(screen.getByText('Στάδια αποστείρωσης')).toBeInTheDocument();
    expect(screen.getByText('Χρήση')).toBeInTheDocument();
    expect(screen.getByLabelText('Διεύθυνση')).toBeInTheDocument();
  });
});
