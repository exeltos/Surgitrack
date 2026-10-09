import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const identity = vi.hoisted(() => ({id: 'user-1' as string | undefined}));
vi.mock('../../../data/cloud/identity', () => ({
  getRealIdentity: () => (identity.id ? {id: identity.id} : undefined),
}));
vi.mock('../../../config/dataMode', () => ({getRuntimeDataMode: () => 'PRODUCTION'}));

import ScreenGuide, {screenSection} from '../ScreenGuide';

const all = () => true;

describe('screen guide on first visit', () => {
  beforeEach(() => {
    localStorage.clear();
    identity.id = 'user-1';
  });

  it('shows the screen from the manual once, then not again for that person', async () => {
    const onHelp = vi.fn();
    const {unmount} = render(<ScreenGuide pathname="/sterilization" lang="el" can={all} onHelp={onHelp} />);
    expect(screen.getByRole('complementary', {name: 'Οδηγός οθόνης'})).toHaveTextContent('Αποστείρωση');
    await userEvent.click(screen.getByRole('button', {name: 'Το κατάλαβα'}));
    expect(screen.queryByRole('complementary')).toBeNull();
    unmount();
    render(<ScreenGuide pathname="/sterilization" lang="el" can={all} onHelp={onHelp} />);
    expect(screen.queryByRole('complementary')).toBeNull();
    identity.id = 'user-2';
    render(<ScreenGuide pathname="/sterilization" lang="el" can={all} onHelp={onHelp} />);
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('opens Help on the screen and can be turned off for every screen', async () => {
    const onHelp = vi.fn();
    const {unmount} = render(<ScreenGuide pathname="/issues" lang="el" can={all} onHelp={onHelp} />);
    await userEvent.click(screen.getByRole('button', {name: /Αναλυτικά στη Βοήθεια/}));
    expect(onHelp).toHaveBeenCalled();
    unmount();
    const {unmount: again} = render(<ScreenGuide pathname="/stock" lang="el" can={all} onHelp={onHelp} />);
    await userEvent.click(screen.getByRole('button', {name: 'Να μην εμφανίζονται οδηγοί'}));
    again();
    render(<ScreenGuide pathname="/reports" lang="el" can={all} onHelp={onHelp} />);
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('only for menu screens the person may open', () => {
    expect(screenSection('/studio', () => false)).toBeUndefined();
    expect(screenSection('/start', all)).toBeUndefined();
    expect(screenSection('/tools/abc', all)).toBeUndefined();
    expect(screenSection('/issues', all)?.to).toBe('/issues');
  });
});
