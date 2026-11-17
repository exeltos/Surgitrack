import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import OrganizationFields from '../OrganizationFields';
import {organizationForm} from '../organizationForm';

describe('the hospital’s fields in its own Settings', () => {
  const hospital = {id: 'h1', name: 'ΙΑΣΩ Θεσσαλίας', code: 'IASO', active: true, demoEnabled: false};

  it('lets the hospital admin see, not change, what the platform owner sets', () => {
    render(
      <OrganizationFields
        readOnly
        value={organizationForm({...hospital, modules: ['DEVICES']})}
        onChange={() => undefined}
      />,
    );
    expect(screen.getByDisplayValue('ΙΑΣΩ Θεσσαλίας')).toBeDisabled();
    expect(screen.getByRole('checkbox', {name: /Συσκευές/})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: /Συσκευές/})).toBeDisabled();
    expect(screen.getByRole('radio', {name: /Κανονική χρήση/})).toBeDisabled();
  });

  it('lets the platform owner change them', () => {
    render(<OrganizationFields value={organizationForm(hospital)} onChange={() => undefined} />);
    expect(screen.getByDisplayValue('IASO')).toBeEnabled();
    expect(screen.getByRole('checkbox', {name: /Συσκευές/})).toBeEnabled();
  });
});
