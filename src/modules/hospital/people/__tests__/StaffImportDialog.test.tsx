import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {PeopleState} from '../usePeople';

const invoke = vi.hoisted(() => vi.fn());
vi.mock('../../../../lib/supabase', () => ({supabase: {functions: {invoke}}}));
const sheet = vi.hoisted(() => ({rows: [] as string[][]}));
vi.mock('../../../../core/sheetImport', () => ({readSheetFile: vi.fn(async () => sheet.rows)}));
const csv = vi.hoisted(() => ({download: vi.fn()}));
vi.mock('../../../../core/exportTable', () => ({downloadCsv: csv.download}));

const {default: StaffImportDialog} = await import('../StaffImportDialog');

const DEPARTMENTS = [
  {id: 'd-or', name: 'ΧΕΙΡΟΥΡΓΕΙΟ', code: 'OR', active: true},
  {id: 'd-ster', name: 'ΑΠΟΣΤΕΙΡΩΣΗ', code: 'CSSD', active: true},
  {id: 'd-old', name: 'ΠΑΛΑΙΟ', code: null, active: false},
];
const changed = vi.fn(async () => undefined);
const state = {
  L: (el: string) => el,
  el: true,
  departments: DEPARTMENTS,
  members: [{name: 'ΕΛΕΝΗ ΚΩΝΣΤΑΝΤΙΝΟΥ'}],
  organizationId: 'org-1',
  roleLabel: (id: string) =>
    ({DEPARTMENT: 'Χρήστης Τμήματος', STERILIZATION: 'Χρήστης Αποστείρωσης', VIEWER: 'Παρατηρητής'})[id] || id,
  changed,
} as unknown as PeopleState;

const HEADER = ['Ονοματεπώνυμο', 'Τμήμα', 'Κινητό', 'Email'];
const open = async (rows: string[][]) => {
  sheet.rows = [HEADER, ...rows];
  const onClose = vi.fn();
  const view = render(<StaffImportDialog s={state} onClose={onClose} />);
  const input = view.container.querySelector('input[type="file"]')!;
  fireEvent.change(input, {target: {files: [new File(['x'], 'staff.xlsx')]}});
  await screen.findByText(/Επιλογή όλων των ορατών/);
  return {...view, onClose};
};
const rowOf = (name: string) => screen.getByText(name).closest('.staff-import-row') as HTMLElement;

beforeEach(() => {
  invoke.mockReset();
  changed.mockClear();
  csv.download.mockClear();
  invoke.mockImplementation(async (_name: string, {body}: {body: {rows: Array<{full_name: string}>}}) => ({
    data: {
      results: body.rows.map((_, index) => ({index, ok: true, user_code: `AB${1000 + index}`})),
      deadline: '2026-11-10T00:00:00Z',
    },
    error: null,
  }));
});

describe("the owner's staff import", () => {
  it('starts with the file, saying what it is and that it is not stored', () => {
    render(<StaffImportDialog s={state} onClose={() => undefined} />);
    expect(screen.getByText('Επιλέξτε το αρχείο με τους εργαζόμενους')).toBeInTheDocument();
    expect(screen.getByText(/Το αρχείο δεν αποθηκεύεται/)).toBeInTheDocument();
    expect(screen.getByText(/ως αρχικό κωδικό το κινητό του/)).toBeInTheDocument();
  });

  it('lists everybody with the department it found and the number masked, nothing chosen yet', async () => {
    await open([
      ['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', ''],
      ['Γιώργος Νικολάου', 'Αποστείρωση', '+30 698 765 4321', 'g@hospital.gr'],
    ]);
    expect(within(rowOf('ΜΑΡΙΑ ΙΩΑΝΝΟΥ')).getByText('691••••678')).toBeInTheDocument();
    expect(screen.queryByText(/6912345678/)).not.toBeInTheDocument();
    expect(within(rowOf('ΜΑΡΙΑ ΙΩΑΝΝΟΥ')).getByLabelText('Τμήμα του ΜΑΡΙΑ ΙΩΑΝΝΟΥ')).toHaveValue('d-or');
    expect(within(rowOf('ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ')).getByLabelText('Τμήμα του ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ')).toHaveValue('d-ster');
    expect(screen.getByRole('button', {name: 'Ενεργοποίηση επιλεγμένων (0)'})).toBeDisabled();
  });

  it('cannot choose someone already in the hospital, or a row with a problem, until it is fixed', async () => {
    await open([
      ['Ελένη Κωνσταντίνου', 'Χειρουργείο', '6911111111', ''],
      ['Πέτρος Ράλλης', 'Κάπου αλλού', '6922222222', ''],
    ]);
    expect(within(rowOf('ΕΛΕΝΗ ΚΩΝΣΤΑΝΤΙΝΟΥ')).getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText('Υπάρχει ήδη στο νοσοκομείο')).toBeInTheDocument();
    expect(within(rowOf('ΠΕΤΡΟΣ ΡΑΛΛΗΣ')).getByRole('checkbox')).toBeDisabled();
    expect(screen.getByText(/Λείπει ή δεν ταιριάζει:/)).toHaveTextContent('τμήμα');
    fireEvent.change(within(rowOf('ΠΕΤΡΟΣ ΡΑΛΛΗΣ')).getByLabelText('Τμήμα του ΠΕΤΡΟΣ ΡΑΛΛΗΣ'), {
      target: {value: 'd-or'},
    });
    expect(within(rowOf('ΠΕΤΡΟΣ ΡΑΛΛΗΣ')).getByRole('checkbox')).toBeEnabled();
    // The inactive department is not offered.
    expect(within(rowOf('ΠΕΤΡΟΣ ΡΑΛΛΗΣ')).queryByRole('option', {name: 'ΠΑΛΑΙΟ'})).not.toBeInTheDocument();
  });

  it('activates only the ones chosen, with their department, role and number, and shows their usernames', async () => {
    await open([
      ['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', ''],
      ['Γιώργος Νικολάου', 'Αποστείρωση', '6987654321', 'g@hospital.gr'],
      ['Άννα Λάμπρου', 'Χειρουργείο', '6933333333', ''],
    ]);
    fireEvent.click(within(rowOf('ΜΑΡΙΑ ΙΩΑΝΝΟΥ')).getByRole('checkbox'));
    fireEvent.click(within(rowOf('ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ')).getByRole('checkbox'));
    fireEvent.change(within(rowOf('ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ')).getByLabelText('Ρόλος του ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ'), {
      target: {value: 'STERILIZATION'},
    });
    fireEvent.click(screen.getByRole('button', {name: 'Ενεργοποίηση επιλεγμένων (2)'}));
    await screen.findByText(/Δημιουργήθηκαν 2 λογαριασμοί/);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('import-staff', {
      body: {
        organization_id: 'org-1',
        deadline_days: 7,
        send_email: true,
        rows: [
          {
            full_name: 'ΜΑΡΙΑ ΙΩΑΝΝΟΥ',
            department_id: 'd-or',
            role: 'DEPARTMENT',
            phone: '6912345678',
            email: undefined,
          },
          {
            full_name: 'ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ',
            department_id: 'd-ster',
            role: 'STERILIZATION',
            phone: '6987654321',
            email: 'g@hospital.gr',
          },
        ],
      },
    });
    expect(screen.getByText('AB1000')).toBeInTheDocument();
    expect(screen.getByText('AB1001')).toBeInTheDocument();
    expect(screen.queryByText('ΆΝΝΑ ΛΆΜΠΡΟΥ')).not.toBeInTheDocument();
    expect(screen.getByText(/Προθεσμία πρώτης σύνδεσης: 10\/11\/2026/)).toBeInTheDocument();
    expect(changed).toHaveBeenCalled();
  });

  it('emails the username and the instructions to those who have an email, unless asked not to', async () => {
    await open([
      ['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', ''],
      ['Γιώργος Νικολάου', 'Αποστείρωση', '6987654321', 'g@gmail.com'],
    ]);
    fireEvent.click(
      screen
        .getByLabelText(/Επιλογή όλων των ορατών/)
        .closest('label')!
        .querySelector('input')!,
    );
    const box = screen.getByLabelText(/Αποστολή email με το όνομα χρήστη/);
    expect(box).toBeChecked();
    expect(screen.getByText(/1 από τους 2 επιλεγμένους έχουν email/)).toBeInTheDocument();
    fireEvent.click(box);
    fireEvent.click(screen.getByRole('button', {name: 'Ενεργοποίηση επιλεγμένων (2)'}));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke.mock.calls[0][1].body.send_email).toBe(false);
  });

  it('says for each person whether the email went, and sends again the ones it did not', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        results: [
          {index: 0, ok: true, user_code: 'MI1111', emailed: true},
          {index: 1, ok: true, user_code: 'GN2222', emailed: false},
          {index: 2, ok: true, user_code: 'AL3333', emailed: false},
        ],
      },
      error: null,
    });
    await open([
      ['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', 'm@gmail.com'],
      ['Γιώργος Νικολάου', 'Αποστείρωση', '6987654321', 'g@gmail.com'],
      ['Άννα Λάμπρου', 'Χειρουργείο', '6933333333', ''],
    ]);
    fireEvent.click(
      screen
        .getByLabelText(/Επιλογή όλων των ορατών/)
        .closest('label')!
        .querySelector('input')!,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Ενεργοποίηση επιλεγμένων (3)'}));
    await screen.findByText(/Στάλθηκαν 1 email/);
    expect(screen.getByText('Στάλθηκε email')).toBeInTheDocument();
    expect(screen.getByText('Το email δεν στάλθηκε')).toBeInTheDocument();
    expect(screen.getByText('Χωρίς email: δώστε του το όνομα χρήστη')).toBeInTheDocument();
    // Only the one with an email whose message did not go is offered again; nobody's number is sent.
    invoke.mockResolvedValueOnce({data: {sent: [{user_code: 'GN2222', emailed: true}]}, error: null});
    fireEvent.click(screen.getByRole('button', {name: 'Επαναποστολή email (1)'}));
    await waitFor(() => expect(screen.queryByRole('button', {name: /Επαναποστολή email/})).not.toBeInTheDocument());
    expect(invoke).toHaveBeenLastCalledWith('import-staff', {body: {organization_id: 'org-1', resend: ['GN2222']}});
    expect(screen.getAllByText('Στάλθηκε email')).toHaveLength(2);
  });

  it('keeps offering the email again when it still could not be sent', async () => {
    invoke.mockResolvedValueOnce({
      data: {results: [{index: 0, ok: true, user_code: 'MI1111', emailed: false}]},
      error: null,
    });
    await open([['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', 'm@gmail.com']]);
    fireEvent.click(within(rowOf('ΜΑΡΙΑ ΙΩΑΝΝΟΥ')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: /Ενεργοποίηση επιλεγμένων/}));
    const again = await screen.findByRole('button', {name: 'Επαναποστολή email (1)'});
    invoke.mockResolvedValueOnce({data: null, error: {message: 'down'}});
    fireEvent.click(again);
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', {name: 'Επαναποστολή email (1)'})).toBeInTheDocument();
  });

  it('sends the deadline chosen', async () => {
    await open([['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', '']]);
    fireEvent.change(screen.getByLabelText(/Προθεσμία πρώτης σύνδεσης/), {target: {value: '14'}});
    fireEvent.click(within(rowOf('ΜΑΡΙΑ ΙΩΑΝΝΟΥ')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: /Ενεργοποίηση επιλεγμένων/}));
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(invoke.mock.calls[0][1].body.deadline_days).toBe(14);
  });

  it('selects everyone shown that can be activated, narrowed by the department filter', async () => {
    await open([
      ['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', ''],
      ['Γιώργος Νικολάου', 'Αποστείρωση', '6987654321', ''],
      ['Ελένη Κωνσταντίνου', 'Χειρουργείο', '6911111111', ''],
    ]);
    fireEvent.change(screen.getByLabelText('Φίλτρο τμήματος'), {target: {value: 'd-or'}});
    fireEvent.click(
      screen
        .getByLabelText(/Επιλογή όλων των ορατών/)
        .closest('label')!
        .querySelector('input')!,
    );
    expect(screen.getByRole('button', {name: 'Ενεργοποίηση επιλεγμένων (1)'})).toBeEnabled();
    expect(screen.queryByText('ΓΙΩΡΓΟΣ ΝΙΚΟΛΑΟΥ')).not.toBeInTheDocument();
  });

  it('sends the people in batches of 25', async () => {
    await open(
      Array.from({length: 30}, (_, i) => [
        `Εργαζόμενος Νούμερο ${String.fromCharCode(913 + (i % 24))}${String.fromCharCode(913 + Math.floor(i / 24))}`,
        'Χειρουργείο',
        `69${String(10000000 + i)}`,
        '',
      ]),
    );
    fireEvent.click(
      screen
        .getByLabelText(/Επιλογή όλων των ορατών/)
        .closest('label')!
        .querySelector('input')!,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Ενεργοποίηση επιλεγμένων (30)'}));
    await screen.findByText(/Δημιουργήθηκαν 30 λογαριασμοί/);
    expect(invoke.mock.calls.map(c => c[1].body.rows.length)).toEqual([25, 5]);
  });

  it('says why a person was not made, and still shows the others', async () => {
    invoke.mockResolvedValueOnce({
      data: {
        results: [
          {index: 0, ok: false, error: 'already_exists'},
          {index: 1, ok: true, user_code: 'GN2222'},
        ],
      },
      error: null,
    });
    await open([
      ['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', ''],
      ['Γιώργος Νικολάου', 'Αποστείρωση', '6987654321', ''],
    ]);
    fireEvent.click(
      screen
        .getByLabelText(/Επιλογή όλων των ορατών/)
        .closest('label')!
        .querySelector('input')!,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Ενεργοποίηση επιλεγμένων (2)'}));
    await screen.findByText(/δεν δημιουργήθηκαν 1/);
    expect(screen.getByText('Υπάρχει ήδη')).toBeInTheDocument();
    expect(screen.getByText('GN2222')).toBeInTheDocument();
  });

  it('marks everyone of a batch that could not be sent as not made', async () => {
    invoke.mockResolvedValueOnce({data: null, error: {message: 'down'}});
    await open([['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', '']]);
    fireEvent.click(within(rowOf('ΜΑΡΙΑ ΙΩΑΝΝΟΥ')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: /Ενεργοποίηση επιλεγμένων/}));
    expect(await screen.findByText('Η αποστολή απέτυχε')).toBeInTheDocument();
  });

  it('downloads the usernames, never a number or a password', async () => {
    await open([['Μαρία Ιωάννου', 'Χειρουργείο', '6912345678', '']]);
    fireEvent.click(within(rowOf('ΜΑΡΙΑ ΙΩΑΝΝΟΥ')).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', {name: /Ενεργοποίηση επιλεγμένων/}));
    fireEvent.click(await screen.findByRole('button', {name: /Λήψη ονομάτων χρήστη/}));
    const table = csv.download.mock.calls[0][0];
    expect(table.headers).toEqual(['Ονοματεπώνυμο', 'Τμήμα', 'Όνομα χρήστη']);
    expect(table.rows).toEqual([['ΜΑΡΙΑ ΙΩΑΝΝΟΥ', 'ΧΕΙΡΟΥΡΓΕΙΟ', 'AB1000']]);
    expect(JSON.stringify(table)).not.toContain('6912345678');
  });

  it('says so when the file has no rows', async () => {
    sheet.rows = [];
    const view = render(<StaffImportDialog s={state} onClose={() => undefined} />);
    fireEvent.change(view.container.querySelector('input[type="file"]')!, {
      target: {files: [new File(['x'], 'a.xlsx')]},
    });
    expect(await screen.findByText('Το αρχείο δεν έχει γραμμές.')).toBeInTheDocument();
  });
});
