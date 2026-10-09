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

  it('rates a part of the app once one of its steps is done', async () => {
    const user = userEvent.setup();
    render(wrap('/overview', <DemoBar role="STERILIZATION" onShowMe={() => undefined} />));
    const stars = await screen.findByRole('radiogroup', {name: 'Ροή Αποστείρωσης'});
    expect(screen.queryByRole('radiogroup', {name: 'Αναφορές'})).not.toBeInTheDocument();
    await user.click(within(stars).getByRole('radio', {name: '4/5'}));
    expect(feedback.rateModule).toHaveBeenCalledWith('org-demo', 'user-1', 'sterilization', 4);
    expect(within(stars).getByRole('radio', {name: '4/5'})).toBeChecked();
  });

  it('sends the final evaluation once ease, fit and NPS are answered', async () => {
    localStorage.setItem('surgitrack-demo-guide-seen-user-1', '1');
    const user = userEvent.setup();
    render(wrap('/overview', <DemoBar role="STERILIZATION" onShowMe={() => undefined} />));
    await user.click(screen.getByRole('button', {name: 'Αξιολόγηση'}));
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
