import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import NoticeComposer, {type NoticeFields} from '../NoticeComposer';

const L = (el: string) => el;
const orgs = [
  {id: 'o1', name: 'ΙΑΣΩ Θεσσαλίας'},
  {id: 'o2', name: 'Κλινική Βορρά'},
];
const upload = vi.fn(async (_file: File) => 'https://x.supabase.co/storage/v1/object/public/promo-images/a.jpg');
const uploadFile = vi.fn(
  async (_file: File) => 'https://x.supabase.co/storage/v1/object/public/promo-images/files/b.pdf',
);
const open = (onPublish = vi.fn(async (_fields: NoticeFields) => true), busy = false) => {
  render(
    <NoticeComposer
      L={L}
      organizations={orgs}
      busy={busy}
      onPublish={onPublish}
      onUploadImage={upload}
      onUploadFile={uploadFile}
    />,
  );
  return onPublish;
};
const write = (label: RegExp | string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), {target: {value}});
const publishButton = () => screen.getByRole('button', {name: 'Δημοσίευση'});

describe('the owner’s form for an announcement or a promotion', () => {
  it('publishes an announcement to every user in every hospital with just a message', async () => {
    const onPublish = open();
    expect(publishButton()).toBeDisabled();
    write(/^Μήνυμα/, 'Συντήρηση την Κυριακή');
    expect(publishButton()).toBeEnabled();
    fireEvent.click(publishButton());
    await waitFor(() => expect(onPublish).toHaveBeenCalledTimes(1));
    expect(onPublish.mock.calls[0][0]).toMatchObject({
      message: 'Συντήρηση την Κυριακή',
      kind: 'NOTICE',
      audience: 'ALL',
      organizationIds: undefined,
    });
    // It empties once published.
    await waitFor(() => expect(screen.getByLabelText(/^Μήνυμα/)).toHaveValue(''));
  });

  it('keeps the text when publishing fails', async () => {
    open(vi.fn(async (_fields: NoticeFields) => false));
    write(/^Μήνυμα/, 'Κείμενο');
    fireEvent.click(publishButton());
    await waitFor(() => expect(screen.getByLabelText(/^Μήνυμα/)).toHaveValue('Κείμενο'));
  });

  it('makes a promotion for the administrators only, which needs a title', () => {
    const onPublish = open();
    fireEvent.click(screen.getByRole('radio', {name: /Προώθηση/}));
    write(/^Κείμενο\d/, 'Ένα προϊόν');
    expect(screen.getByRole('alert')).toHaveTextContent('Η προώθηση χρειάζεται τίτλο.');
    expect(publishButton()).toBeDisabled();
    // The audience cannot be everyone.
    expect(screen.getByRole('radio', {name: 'Όλοι οι χρήστες'})).toBeDisabled();
    expect(screen.getByRole('radio', {name: /Μόνο διαχειριστές/})).toBeChecked();
    write('Τίτλος', 'Προϊόν Χ');
    expect(publishButton()).toBeEnabled();
    fireEvent.click(publishButton());
    expect(onPublish.mock.calls[0][0]).toMatchObject({kind: 'PROMO', audience: 'ADMINS', title: 'Προϊόν Χ'});
  });

  it('refuses a link that is not https', () => {
    open();
    write(/^Μήνυμα/, 'Κείμενο');
    write(/Σύνδεσμος/, 'http://example.com');
    expect(screen.getByRole('alert')).toHaveTextContent('https://');
    expect(publishButton()).toBeDisabled();
    write(/Σύνδεσμος/, 'https://example.com');
    expect(publishButton()).toBeEnabled();
    // The button text can then be chosen.
    expect(screen.getByLabelText('Κείμενο κουμπιού')).toBeInTheDocument();
  });

  it('picks the hospitals from a searchable list, and wants at least one', async () => {
    const onPublish = open();
    write(/^Μήνυμα/, 'Κείμενο');
    fireEvent.click(screen.getByRole('radio', {name: 'Μόνο επιλεγμένα'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Διαλέξτε τουλάχιστον ένα νοσοκομείο.');
    write('Αναζήτηση νοσοκομείου', 'βορρά');
    const list = screen.getByRole('list');
    expect(within(list).queryByText('ΙΑΣΩ Θεσσαλίας')).not.toBeInTheDocument();
    fireEvent.click(within(list).getByRole('checkbox', {name: 'Κλινική Βορρά'}));
    expect(publishButton()).toBeEnabled();
    fireEvent.click(publishButton());
    await waitFor(() => expect(onPublish.mock.calls[0][0].organizationIds).toEqual(['o2']));
  });

  it('shows what the administrators will see and who gets it', () => {
    open();
    const preview = screen.getByRole('complementary', {name: 'Προεπισκόπηση'});
    expect(within(preview).getByText('Το μήνυμα θα εμφανιστεί εδώ.')).toBeInTheDocument();
    write(/^Μήνυμα/, 'Συντήρηση');
    expect(within(preview).getByText('Συντήρηση')).toBeInTheDocument();
    expect(within(preview).getByText(/Όλοι οι χρήστες · όλα τα νοσοκομεία/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', {name: /Προώθηση/}));
    expect(within(preview).getByText('Τίτλος προώθησης')).toBeInTheDocument();
    expect(within(preview).getByText(/Διαχειριστές · όλα τα νοσοκομεία/)).toBeInTheDocument();
  });

  it('does not publish while another action is running', () => {
    open(undefined, true);
    write(/^Μήνυμα/, 'Κείμενο');
    expect(publishButton()).toBeDisabled();
  });

  it('uploads a picture chosen on the device, shows it, and publishes its address', async () => {
    const onPublish = open();
    fireEvent.click(screen.getByRole('radio', {name: /Προώθηση/}));
    write(/^Κείμενο\d/, 'Ένα προϊόν');
    write('Τίτλος', 'Προϊόν Χ');
    const file = new File(['x'], 'p.png', {type: 'image/png'});
    fireEvent.change(screen.getByLabelText('Επιλογή εικόνας'), {target: {files: [file]}});
    await waitFor(() => expect(document.querySelector('.notice-preview img')).toBeTruthy());
    expect(upload).toHaveBeenCalledWith(file);
    fireEvent.click(publishButton());
    await waitFor(() =>
      expect(onPublish.mock.calls[0][0]).toMatchObject({imageUrl: expect.stringContaining('promo-images')}),
    );
  });

  it('says so when the picture does not upload', async () => {
    upload.mockRejectedValueOnce(new Error('no'));
    open();
    fireEvent.click(screen.getByRole('radio', {name: /Προώθηση/}));
    write(/^Κείμενο\d/, 'Ένα προϊόν');
    write('Τίτλος', 'Προϊόν Χ');
    fireEvent.change(screen.getByLabelText('Επιλογή εικόνας'), {
      target: {files: [new File(['x'], 'p.png', {type: 'image/png'})]},
    });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('δεν ανέβηκε'));
  });

  it('enlarges the promotion into the card the hospital sees in front of its screen', () => {
    open();
    fireEvent.click(screen.getByRole('radio', {name: /Προώθηση/}));
    write('Τίτλος', 'EXELTOS');
    write(/^Κείμενο\d/, 'Εφαρμογές cloud');
    write(/Σύνδεσμος/, 'https://exeltos.com/');
    write('Κείμενο κουμπιού', 'Πατήστε εδώ');
    fireEvent.click(screen.getByRole('button', {name: /Μεγέθυνση/}));
    const dialog = screen.getByRole('dialog', {name: 'EXELTOS'});
    expect(within(dialog).getByText('Εφαρμογές cloud')).toBeInTheDocument();
    expect(within(dialog).getByRole('link', {name: /Πατήστε εδώ/})).toHaveAttribute('href', 'https://exeltos.com/');
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lets a promotion be longer than an announcement', () => {
    open();
    fireEvent.click(screen.getByRole('radio', {name: /Προώθηση/}));
    write('Τίτλος', 'Χ');
    write(/^Κείμενο\d/, 'α'.repeat(500));
    expect(publishButton()).toBeEnabled();
    fireEvent.click(screen.getByRole('radio', {name: /Ανακοίνωση/}));
    expect(screen.getByRole('alert')).toHaveTextContent('έως 300');
    expect(publishButton()).toBeDisabled();
  });

  it('places the picture where the owner chooses and attaches a PDF', async () => {
    const onPublish = open();
    fireEvent.click(screen.getByRole('radio', {name: /Προώθηση/}));
    write('Τίτλος', 'EXELTOS');
    write(/^Κείμενο\d/, 'Κείμενο');
    // The position appears once there is a picture.
    expect(screen.queryByRole('radiogroup', {name: 'Θέση εικόνας στην κάρτα'})).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Επιλογή εικόνας'), {
      target: {files: [new File(['x'], 'p.png', {type: 'image/png'})]},
    });
    fireEvent.click(await screen.findByRole('radio', {name: 'Αριστερά'}));
    fireEvent.change(screen.getByLabelText('Επιλογή αρχείου PDF'), {
      target: {files: [new File(['%PDF'], 'Φυλλάδιο.pdf', {type: 'application/pdf'})]},
    });
    expect(await screen.findByText('Φυλλάδιο.pdf')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /Μεγέθυνση/}));
    const dialog = screen.getByRole('dialog', {name: 'EXELTOS'});
    expect(dialog).toHaveClass('layout-left');
    expect(within(dialog).getByRole('link', {name: /Φυλλάδιο\.pdf/})).toHaveAttribute(
      'href',
      expect.stringContaining('b.pdf'),
    );
    fireEvent.keyDown(window, {key: 'Escape'});
    fireEvent.click(publishButton());
    await waitFor(() =>
      expect(onPublish.mock.calls[0][0]).toMatchObject({
        imageLayout: 'LEFT',
        attachmentName: 'Φυλλάδιο.pdf',
        attachmentUrl: expect.stringContaining('b.pdf'),
      }),
    );
  });
});
