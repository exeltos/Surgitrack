import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import AssetImportWizard from '../AssetImportWizard';

const props = {
  lang: 'el' as const,
  organizations: [{id: 'h1', name: 'ΙΑΣΩ Θεσσαλίας'}],
  departments: [],
  byName: 'Owner',
};

describe('the hospital of a bulk import', () => {
  it('is the open hospital, already chosen, inside a hospital', () => {
    render(<AssetImportWizard {...props} />);
    expect(screen.queryByRole('combobox', {name: /Νοσοκομείο/})).toBeNull();
    expect(screen.getByText('ΙΑΣΩ Θεσσαλίας')).toBeInTheDocument();
  });

  it('is chosen by the platform owner, even with one hospital, and starts with none', () => {
    render(<AssetImportWizard {...props} choose />);
    const select = screen.getByRole('combobox', {name: /Νοσοκομείο/}) as HTMLSelectElement;
    expect(select.value).toBe('');
  });
});
