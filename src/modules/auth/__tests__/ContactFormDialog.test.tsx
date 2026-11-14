import {beforeEach, describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import ContactFormDialog from '../ContactFormDialog';
import {sendContactRequest} from '../../../data/cloud/contactRequests';

vi.mock('../../../data/cloud/contactRequests', () => ({sendContactRequest: vi.fn(async () => ({ok: true}))}));

const type = (label: RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), {target: {value}});
const fill = () => {
  type(/Ονοματεπώνυμο/, 'Μαρία Παπαδάκη');
  type(/Νοσοκομείο/, 'Γενικό Νοσοκομείο');
  type(/Ρόλος/, 'Προϊσταμένη');
  type(/Τηλέφωνο/, '2100000000');
  type(/^Email/, 'maria@example.test');
  type(/Μήνυμα/, 'Θα θέλαμε παρουσίαση.');
};

beforeEach(() => vi.mocked(sendContactRequest).mockClear());

describe('«Ζητήστε παρουσίαση»', () => {
  it('sends the six fields and thanks the visitor', async () => {
    render(<ContactFormDialog lang="el" email="info@exeltos.com" onClose={() => undefined} />);
    expect(screen.getByRole('dialog', {name: 'Ζητήστε παρουσίαση'})).toBeInTheDocument();
    fill();
    fireEvent.click(screen.getByRole('button', {name: 'Αποστολή'}));
    expect(await screen.findByText('Ευχαριστούμε!')).toBeInTheDocument();
    expect(sendContactRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Μαρία Παπαδάκη',
        organization: 'Γενικό Νοσοκομείο',
        role: 'Προϊσταμένη',
        phone: '2100000000',
        email: 'maria@example.test',
        message: 'Θα θέλαμε παρουσίαση.',
        website: '',
      }),
    );
  });

  it('asks for a name, a valid email and a message before sending', () => {
    render(<ContactFormDialog lang="el" email="info@exeltos.com" onClose={() => undefined} />);
    type(/Ονοματεπώνυμο/, 'Μαρία');
    type(/^Email/, 'not-an-email');
    fireEvent.click(screen.getByRole('button', {name: 'Αποστολή'}));
    expect(screen.getByRole('alert')).toHaveTextContent('σωστό email');
    expect(sendContactRequest).not.toHaveBeenCalled();
  });

  it('offers the email address when the request cannot be sent', async () => {
    vi.mocked(sendContactRequest).mockResolvedValueOnce({ok: false, reason: 'unavailable'});
    render(<ContactFormDialog lang="el" email="info@exeltos.com" onClose={() => undefined} />);
    fill();
    fireEvent.click(screen.getByRole('button', {name: 'Αποστολή'}));
    expect(await screen.findByRole('link', {name: 'info@exeltos.com'})).toHaveAttribute(
      'href',
      'mailto:info@exeltos.com',
    );
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<ContactFormDialog lang="el" email="info@exeltos.com" onClose={onClose} />);
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).toHaveBeenCalled();
  });
});
