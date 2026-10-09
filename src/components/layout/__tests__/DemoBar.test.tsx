import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import type {ReactNode} from 'react';

const service = vi.hoisted(() => ({
  loadGuideDone: vi.fn(),
  markGuideSteps: vi.fn(),
  findDoneRecordSteps: vi.fn(),
}));
vi.mock('../../../data/cloud/demoGuide', () => service);
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
});
