import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type {ReactNode} from 'react';

const service = vi.hoisted(() => ({
  loadGuideDone: vi.fn(),
  markGuideSteps: vi.fn(),
  findDoneRecordSteps: vi.fn(),
}));
vi.mock('../../../data/cloud/demoGuide', () => service);
const feedback = vi.hoisted(() => ({
  loadMyFeedback: vi.fn(),
  rateModule: vi.fn(),
  saveFinalEvaluation: vi.fn(),
  sendDemoRequest: vi.fn(),
}));
vi.mock('../../../data/cloud/demoFeedback', () => feedback);
vi.mock('../../../data/cloud/identity', () => ({getRealIdentity: () => ({id: 'user-1'})}));

import DemoBar from '../DemoBar';
import {EvaluationDemoContext} from '../../../data/cloud/demoContext';
import {AppPreferencesProvider} from '../../../core/AppPreferences';

const DEMO = {
  organizationId: 'org-demo',
  hospitalName: 'Γ.Ν. Λάρισας · Demo',
  endsAt: new Date(Date.now() + 10 * 864e5).toISOString(),
};
const wrap = (path: string, children: ReactNode, demo = DEMO) => (
  <AppPreferencesProvider>
    <MemoryRouter initialEntries={[path]}>
      <EvaluationDemoContext.Provider value={demo}>{children}</EvaluationDemoContext.Provider>
    </MemoryRouter>
  </AppPreferencesProvider>
);

beforeEach(() => {
  localStorage.clear();
  Object.values(service).forEach(fn => fn.mockReset());
  service.loadGuideDone.mockResolvedValue(new Set(['receive']));
  service.findDoneRecordSteps.mockResolvedValue(['prepare']);
  service.markGuideSteps.mockResolvedValue(undefined);
  Object.values(feedback).forEach(fn => fn.mockReset());
  feedback.loadMyFeedback.mockResolvedValue(new Map());
  feedback.rateModule.mockResolvedValue(undefined);
  feedback.saveFinalEvaluation.mockResolvedValue(undefined);
  feedback.sendDemoRequest.mockResolvedValue(undefined);
});

describe('Demo bar', () => {
  it('shows the days left and opens the guide by itself the first time', async () => {
    render(wrap('/overview', <DemoBar role="STERILIZATION" onShowMe={() => undefined} />));
    expect(screen.getByText(/Απομένουν 10 ημέρες/)).toBeInTheDocument();
    expect(await screen.findByRole('complementary', {name: 'Πρώτα βήματα'})).toBeInTheDocument();
  });

  it('marks steps done from the person’s own records', async () => {
    render(wrap('/overview', <DemoBar role="STERILIZATION" onShowMe={() => undefined} />));
    await waitFor(() => expect(service.markGuideSteps).toHaveBeenCalledWith('org-demo', 'user-1', ['prepare']));
    expect(await screen.findByText('2/7')).toBeInTheDocument();
  });

  it('marks a visit step when its screen is open', async () => {
    service.findDoneRecordSteps.mockResolvedValue([]);
    render(wrap('/traceability', <DemoBar role="STERILIZATION" onShowMe={() => undefined} />));
    await waitFor(() => expect(service.markGuideSteps).toHaveBeenCalledWith('org-demo', 'user-1', ['trace']));
  });

  it('"Show me" opens the step’s screen', async () => {
    localStorage.setItem('surgitrack-demo-guide-seen-user-1', '1');
    const onShowMe = vi.fn();
    const user = userEvent.setup();
    render(wrap('/overview', <DemoBar role="DEPARTMENT" onShowMe={onShowMe} />));
    await user.click(screen.getByRole('button', {name: /Πρώτα βήματα/}));
    await user.click((await screen.findAllByRole('button', {name: 'Δείξε μου'}))[0]);
    expect(onShowMe).toHaveBeenCalledWith('/department');
  });

  it('is not there outside an evaluation Demo', () => {
    const {container} = render(
      <AppPreferencesProvider>
        <MemoryRouter>
          <EvaluationDemoContext.Provider value={null}>
            <DemoBar role="ADMIN" onShowMe={() => undefined} />
          </EvaluationDemoContext.Provider>
        </MemoryRouter>
      </AppPreferencesProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('rates each step done, in the guide', async () => {
    const user = userEvent.setup();
    render(wrap('/overview', <DemoBar role="STERILIZATION" onShowMe={() => undefined} />));
    const stars = await screen.findByRole('radiogroup', {name: 'Παραλαβή από τμήμα'});
    // A step not done yet has "Show me" instead of stars.
    expect(screen.queryByRole('radiogroup', {name: 'Αποδέσμευση'})).not.toBeInTheDocument();
    await user.click(within(stars).getByRole('radio', {name: '4/5'}));
    expect(feedback.rateModule).toHaveBeenCalledWith('org-demo', 'user-1', 'step_receive', 4, undefined);
    expect(within(stars).getByRole('radio', {name: '4/5'})).toBeChecked();
  });

  it('asks how a step was as soon as it is done, with a comment, and «Later» leaves it', async () => {
    localStorage.setItem('surgitrack-demo-guide-seen-user-1', '1');
    service.findDoneRecordSteps.mockResolvedValue([]);
    const user = userEvent.setup();
    const bar = (savedAt?: number) =>
      wrap('/overview', <DemoBar role="STERILIZATION" onShowMe={() => undefined} savedAt={savedAt} />);
    const {rerender} = render(bar());
    await waitFor(() => expect(service.loadGuideDone).toHaveBeenCalled());
    // Steps already done on opening the app bring no card, and there is no «Evaluate» yet.
    expect(screen.queryByRole('complementary', {name: 'Αξιολόγηση βήματος'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Αξιολόγηση'})).not.toBeInTheDocument();
    // The person records a preparation; once the app has saved it, the step is found done.
    service.findDoneRecordSteps.mockResolvedValue(['prepare']);
    rerender(bar(Date.now()));
    const card = await screen.findByRole('complementary', {name: 'Αξιολόγηση βήματος'}, {timeout: 3000});
    expect(within(card).getByText('Ολοκληρώσατε: Σύνθεση και έλεγχος')).toBeInTheDocument();
    expect(within(card).getByRole('button', {name: 'Αποστολή'})).toBeDisabled();
    await user.click(within(card).getByRole('radio', {name: '5/5'}));
    await user.type(within(card).getByRole('textbox', {name: 'Σχόλιο'}), 'Πολύ καθαρό');
    await user.click(within(card).getByRole('button', {name: 'Αποστολή'}));
    expect(feedback.rateModule).toHaveBeenCalledWith('org-demo', 'user-1', 'step_prepare', 5, 'Πολύ καθαρό');
    expect(screen.queryByRole('complementary', {name: 'Αξιολόγηση βήματος'})).not.toBeInTheDocument();
  });

  it('after the last step, asks for the final evaluation', async () => {
    localStorage.setItem('surgitrack-demo-guide-seen-user-1', '1');
    service.loadGuideDone.mockResolvedValue(new Set(['receive', 'prepare', 'cycle', 'release', 'trace', 'reports']));
    service.findDoneRecordSteps.mockResolvedValue([]);
    const user = userEvent.setup();
    const bar = (savedAt?: number) =>
      wrap('/overview', <DemoBar role="STERILIZATION" onShowMe={() => undefined} savedAt={savedAt} />);
    const {rerender} = render(bar());
    await waitFor(() => expect(service.loadGuideDone).toHaveBeenCalled());
    service.findDoneRecordSteps.mockResolvedValue(['deliver']);
    rerender(bar(Date.now()));
    const card = await screen.findByRole('complementary', {name: 'Αξιολόγηση βήματος'}, {timeout: 3000});
    await user.click(within(card).getByRole('button', {name: 'Αργότερα'}));
    const final = await screen.findByRole('complementary', {name: 'Τελική αξιολόγηση'});
    await user.click(within(final).getByRole('button', {name: 'Κάντε την τελική αξιολόγηση'}));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('sends the final evaluation once ease, fit and NPS are answered', async () => {
    localStorage.setItem('surgitrack-demo-guide-seen-user-1', '1');
    // Most of the guide done: «Evaluate» appears at the top.
    service.loadGuideDone.mockResolvedValue(new Set(['receive', 'prepare', 'cycle', 'release', 'deliver', 'trace']));
    const user = userEvent.setup();
    render(wrap('/overview', <DemoBar role="STERILIZATION" onShowMe={() => undefined} />));
    await user.click(await screen.findByRole('button', {name: 'Αξιολόγηση'}));
    const dialog = screen.getByRole('dialog', {name: 'Αξιολόγηση'});
    const send = within(dialog).getByRole('button', {name: 'Αποστολή αξιολόγησης'});
    expect(send).toBeDisabled();
    await user.click(
      within(within(dialog).getByRole('radiogroup', {name: 'Ευκολία χρήσης'})).getByRole('radio', {name: '5/5'}),
    );
    await user.click(
      within(within(dialog).getByRole('radiogroup', {name: 'Καταλληλότητα'})).getByRole('radio', {name: '4/5'}),
    );
    await user.click(within(within(dialog).getByRole('radiogroup', {name: 'NPS'})).getByRole('radio', {name: '9'}));
    await user.type(within(dialog).getByLabelText('Περίπου πόσα Σετ έχει το νοσοκομείο;'), '350');
    await user.click(send);
    expect(feedback.saveFinalEvaluation).toHaveBeenCalledWith('org-demo', 'user-1', {
      nps: 9,
      answers: {ease: 5, fit: 4, sets: 350},
      comment: '',
    });
    expect(await within(dialog).findByText('Ευχαριστούμε πολύ για την αξιολόγηση!')).toBeInTheDocument();
    await user.click(within(dialog).getAllByRole('button', {name: 'Κλείσιμο'})[1]);
    expect(screen.getByRole('button', {name: 'Η αξιολόγησή σας'})).toBeInTheDocument();
  });

  it('sends "I want the application" with a phone number', async () => {
    localStorage.setItem('surgitrack-demo-guide-seen-user-1', '1');
    const user = userEvent.setup();
    render(wrap('/overview', <DemoBar role="ADMIN" onShowMe={() => undefined} />));
    await user.click(screen.getByRole('button', {name: 'Θέλω την εφαρμογή'}));
    const dialog = screen.getByRole('dialog', {name: 'Θέλω την εφαρμογή'});
    await user.type(within(dialog).getByLabelText('Τηλέφωνο'), ' 2410 000000 ');
    await user.click(within(dialog).getByRole('button', {name: 'Αποστολή'}));
    expect(feedback.sendDemoRequest).toHaveBeenCalledWith('org-demo', 'user-1', {
      kind: 'PURCHASE',
      contactName: '',
      phone: '2410 000000',
      message: '',
    });
    expect(await within(dialog).findByText(/Λάβαμε το ενδιαφέρον σας/)).toBeInTheDocument();
  });
});
