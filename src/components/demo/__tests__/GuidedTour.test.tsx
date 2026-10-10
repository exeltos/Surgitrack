import {describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import GuidedTour from '../GuidedTour';
import type {Tour} from '../../../core/demoTours';

const L = (el: string) => el;
const tour: Tour = {
  key: 'receive',
  to: '/sterilization',
  stops: [
    {target: '#tab', title: {el: 'Η καρτέλα', en: ''}, text: {el: 'Πατήστε την.', en: ''}, advance: 'click'},
    {title: {el: 'Τέλος', en: ''}, text: {el: 'Αυτό ήταν.', en: ''}},
  ],
};

describe('a guided tour', () => {
  it('moves on when the person presses what the note points at, and ends with Done', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(
      <>
        <button id="tab">Παραλαβή</button>
        <GuidedTour tour={tour} L={L} onClose={() => undefined} onDone={onDone} />
      </>,
    );
    expect(screen.getByText('Η καρτέλα')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Παραλαβή'));
    act(() => void vi.advanceTimersByTime(400));
    expect(screen.getByText('Αυτό ήταν.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Τέλος'}));
    expect(onDone).toHaveBeenCalled();
    vi.useRealTimers();
  });
  it('ends on Escape', () => {
    const onClose = vi.fn();
    render(<GuidedTour tour={tour} L={L} onClose={onClose} onDone={() => undefined} />);
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).toHaveBeenCalled();
  });
});
