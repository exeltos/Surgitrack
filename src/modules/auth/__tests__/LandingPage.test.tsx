import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import LandingPage from '../LandingPage';

describe('the public first page', () => {
  it('shows how to reach the company and opens the sign-in screen', () => {
    const onSignIn = vi.fn();
    render(<LandingPage onSignIn={onSignIn} />);
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Κάθε εργαλείο');
    expect(screen.getByRole('link', {name: 'info@exeltos.com'})).toHaveAttribute(
      'href',
      expect.stringContaining('mailto:info@exeltos.com'),
    );
    expect(screen.getByRole('link', {name: '694 247 1022'})).toHaveAttribute('href', 'tel:+306942471022');
    expect(screen.getByRole('link', {name: 'exeltos.com'})).toHaveAttribute('href', 'https://exeltos.com/');
    // No account is made here: only sign-in.
    expect(screen.queryByText(/Δημιουργία λογαριασμού|Εγγραφή/)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Σύνδεση'}));
    expect(onSignIn).toHaveBeenCalled();
  });

  it('switches to English', () => {
    render(<LandingPage onSignIn={() => undefined} />);
    fireEvent.click(screen.getByRole('button', {name: 'EN'}));
    expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('Every instrument');
    expect(screen.getByRole('button', {name: 'Sign in'})).toBeInTheDocument();
  });
});
