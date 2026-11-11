import {useEffect, useState, type ReactNode} from 'react';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach, describe, expect, it} from 'vitest';
import {LibraryStoreProvider, useLibraries} from '../../../core/LibraryStore';
import {SurgiProvider} from '../../../store/SurgiStore';
import AssetCreatePage from '../AssetCreatePage';

const Wrapper = ({children}: {children: ReactNode}) => (
  <MemoryRouter>
    <LibraryStoreProvider>
      <SurgiProvider dataMode="DEMO">{children}</SurgiProvider>
    </LibraryStoreProvider>
  </MemoryRouter>
);

const usageSelect = () => screen.getByLabelText(/Τύπος χρήσης/) as HTMLSelectElement;

describe('the usage type a new instrument starts with', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    sessionStorage.setItem('surgitrack-demo-role', 'ADMIN');
  });

  it('is the hospital default, and no limit when none is set', () => {
    render(<AssetCreatePage kind="TOOL" />, {wrapper: Wrapper});
    expect(usageSelect().value).toBe('UNLIMITED');
  });

  it('follows the default the owner chose in Settings', () => {
    // The page is mounted only after the setting is saved, as when it is opened later.
    const Gate = () => {
      const libs = useLibraries();
      const [ready, setReady] = useState(false);
      useEffect(() => {
        libs.updateSystemSettings({defaultUsageType: 'WEAR'});
        setReady(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return ready ? <AssetCreatePage kind="TOOL" /> : null;
    };
    render(<Gate />, {wrapper: Wrapper});
    expect(usageSelect().value).toBe('WEAR');
  });
});
