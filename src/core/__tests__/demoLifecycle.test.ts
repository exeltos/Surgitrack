import {describe, expect, it} from 'vitest';
import {DEMO_DELETE_AFTER_DAYS, demoDeleteOn, demoFunnel, demoStage, type DemoAccount} from '../demoAccounts';

const NOW = Date.parse('2026-10-09T09:00:00Z');
const inDays = (days: number) => new Date(NOW + days * 864e5).toISOString();
const demo = (patch: Partial<DemoAccount> = {}): DemoAccount => ({
  id: 'd',
  organizationId: 'o',
  organizationName: 'Demo',
  code: 'DEMO-1',
  hospitalName: 'Γ.Ν.',
  contactName: 'Μ',
  contactEmail: 'm@h.gr',
  status: 'SENT',
  maxExtraUsers: 5,
  autoDelete: true,
  endsAt: inDays(5),
  active: true,
  createdAt: inDays(-10),
  evaluatorActive: false,
  extraUsers: 0,
  colleagues: [],
  ratings: [],
  evaluations: [],
  requests: [],
  ...patch,
});

describe('evaluation Demo lifecycle', () => {
  it('is a customer once converted, whatever its old end date', () => {
    expect(demoStage({status: 'CONVERTED', endsAt: inDays(-40), evaluatorActive: true}, NOW)).toBe('CONVERTED');
  });

  it('is deleted 30 days after its end, unless kept or converted', () => {
    expect(DEMO_DELETE_AFTER_DAYS).toBe(30);
    expect(demoDeleteOn(demo({endsAt: inDays(5)}))).toBe(inDays(35));
    expect(demoDeleteOn(demo({autoDelete: false}))).toBeUndefined();
    expect(demoDeleteOn(demo({status: 'CONVERTED'}))).toBeUndefined();
    expect(demoDeleteOn(demo({endsAt: undefined}))).toBeUndefined();
  });

  it('counts how far the Demos went, and the average recommendation', () => {
    const guide = {done: 1, total: 7};
    const funnel = demoFunnel([
      demo({status: 'PREPARING'}),
      demo(),
      demo({evaluatorActive: true, evaluatorGuide: guide}),
      demo({
        evaluatorActive: true,
        evaluatorGuide: {done: 0, total: 7},
        colleagues: [{id: 'c', name: 'Ν', email: 'n@h.gr', role: 'DEPARTMENT', active: true, guide}],
        evaluations: [
          {name: 'Μ', nps: 9},
          {name: 'Ν', nps: null},
        ],
        requests: [{id: 'r', kind: 'EXTENSION', name: 'Μ', status: 'NEW', createdAt: inDays(0)}],
      }),
      demo({
        status: 'CONVERTED',
        evaluations: [{name: 'Κ', nps: 6}],
        requests: [{id: 'r2', kind: 'PURCHASE', name: 'Κ', status: 'HANDLED', createdAt: inDays(-3)}],
      }),
    ]);
    expect(Object.fromEntries(funnel.steps.map(s => [s.key, s.count]))).toEqual({
      opened: 5,
      sent: 4,
      signedIn: 3,
      tried: 2,
      evaluated: 2,
      wanted: 1,
      converted: 1,
    });
    expect(funnel.averageNps).toBe(7.5);
    expect(demoFunnel([]).averageNps).toBeUndefined();
  });
});
