import {useState} from 'react';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {HandoverSigner} from '../../../data/cloud/handover';

const verifyHandover = vi.fn();
vi.mock('../../../data/cloud/handover', async original => ({
  ...(await original<typeof import('../../../data/cloud/handover')>()),
  isDemoHandover: () => false,
  verifyHandover: (...args: unknown[]) => verifyHandover(...args),
}));
const {default: HandoverSignature} = await import('../HandoverSignature');

const SIGNER: HandoverSigner = {
  code: 'OR2187',
  userId: 'u-or',
  name: 'Νοσηλεύτρια',
  department: 'Χειρουργείο',
  role: 'Χρήστης Τμήματος',
  signatureId: 'sig-1',
};

/** The batch screen: the signature panel and the items being handed over, which can change. */
function Batch() {
  const [items, setItems] = useState(['set-1', 'set-2']);
  const [signer, setSigner] = useState<HandoverSigner | null>(null);
  return (
    <>
      <HandoverSignature label="Υπογραφή" signer={signer} onSigned={setSigner} assetIds={items} />
      <button onClick={() => setItems(['set-1', 'set-2', 'set-3'])}>add</button>
      <button onClick={() => setItems(['set-2', 'set-1'])}>reorder</button>
      <output>{signer ? `signed ${signer.signatureId}` : 'unsigned'}</output>
    </>
  );
}

const signIn = async () => {
  fireEvent.change(screen.getByLabelText('Κωδικός χρήστη'), {target: {value: 'OR2187'}});
  fireEvent.change(screen.getByLabelText('Συνθηματικό'), {target: {value: 'secret'}});
  fireEvent.click(screen.getByRole('button', {name: 'Υπογραφή'}));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('signed sig-1'));
};

describe('handover signature', () => {
  beforeEach(() => {
    verifyHandover.mockReset();
    verifyHandover.mockResolvedValue({ok: true, signer: SIGNER});
  });

  it('signs for the items of this handover', async () => {
    render(<Batch />);
    await signIn();
    expect(verifyHandover).toHaveBeenCalledWith('OR2187', 'secret', ['set-1', 'set-2']);
  });

  it('keeps the signature while the same items stay on screen', async () => {
    render(<Batch />);
    await signIn();
    fireEvent.click(screen.getByRole('button', {name: 'reorder'}));
    expect(screen.getByRole('status').textContent).toBe('signed sig-1');
  });

  it('asks for a new signature when the items change after signing', async () => {
    render(<Batch />);
    await signIn();
    fireEvent.click(screen.getByRole('button', {name: 'add'}));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('unsigned'));
  });
});
