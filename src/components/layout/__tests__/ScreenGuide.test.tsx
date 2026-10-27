import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ScreenGuide, {screenSection} from '../ScreenGuide';

const all = () => true;
const show = (pathname: string, extra: {onHelp?: () => void; onClose?: () => void} = {}) =>
  render(
    <ScreenGuide
      pathname={pathname}
      lang="el"
      can={all}
      onHelp={extra.onHelp ?? vi.fn()}
      onClose={extra.onClose ?? vi.fn()}
    />,
  );

describe('screen guide, opened on request', () => {
  it('shows the screen from the manual with its first steps', () => {
    show('/sterilization');
    expect(screen.getByRole('complementary', {name: 'Οδηγός οθόνης'})).toHaveTextContent('Αποστείρωση');
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('closes, and opens Help on the screen', async () => {
    const onClose = vi.fn();
    const onHelp = vi.fn();
    show('/issues', {onClose, onHelp});
    await userEvent.click(screen.getByRole('button', {name: 'Το κατάλαβα'}));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', {name: /Αναλυτικά στη Βοήθεια/}));
    expect(onHelp).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('shows nothing for a screen the manual does not describe', () => {
    show('/start');
    expect(screen.queryByRole('complementary')).toBeNull();
  });

  it('only for menu screens the person may open', () => {
    expect(screenSection('/studio', () => false)).toBeUndefined();
    expect(screenSection('/start', all)).toBeUndefined();
    expect(screenSection('/tools/abc', all)).toBeUndefined();
    expect(screenSection('/issues', all)?.to).toBe('/issues');
  });
});
