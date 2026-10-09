import {describe, expect, it} from 'vitest';
import {DEFAULT_DEMO_DAYS, DEMO_LENGTHS, demoDaysLeft, demoNextStep, demoStage, isValidEmail} from '../demoAccounts';

const NOW = Date.parse('2026-10-09T09:00:00Z');
const inDays = (days: number) => new Date(NOW + days * 864e5).toISOString();

describe('evaluation Demos', () => {
  it('opens for 14 days unless the owner picks otherwise', () => {
    expect(DEFAULT_DEMO_DAYS).toBe(14);
    expect(DEMO_LENGTHS).toContain(DEFAULT_DEMO_DAYS);
  });

  it('is in preparation until the email goes out', () => {
    expect(demoStage({status: 'PREPARING', endsAt: inDays(14), evaluatorActive: false}, NOW)).toBe('PREPARING');
  });

  it('is sent until the prospect signs in, then being evaluated', () => {
    expect(demoStage({status: 'SENT', endsAt: inDays(14), evaluatorActive: false}, NOW)).toBe('INVITED');
    expect(demoStage({status: 'SENT', endsAt: inDays(14), evaluatorActive: true}, NOW)).toBe('ACTIVE');
  });

  it('has ended once its end date has passed, whatever else', () => {
    expect(demoStage({status: 'SENT', endsAt: inDays(-1), evaluatorActive: true}, NOW)).toBe('ENDED');
    expect(demoStage({status: 'PREPARING', endsAt: inDays(-1), evaluatorActive: false}, NOW)).toBe('ENDED');
  });

  it('counts the days left, and 0 once ended', () => {
    expect(demoDaysLeft({endsAt: inDays(14)}, NOW)).toBe(14);
    expect(demoDaysLeft({endsAt: inDays(-3)}, NOW)).toBe(0);
    expect(demoDaysLeft({}, NOW)).toBe(0);
  });

  it('prepares in order: the sample data, then the email', () => {
    expect(demoNextStep({status: 'PREPARING'})).toBe('SEED');
    expect(demoNextStep({status: 'PREPARING', seededAt: inDays(0)})).toBe('INVITE');
    expect(demoNextStep({status: 'SENT', seededAt: inDays(0)})).toBeNull();
  });

  it('checks the contact email', () => {
    expect(isValidEmail(' maria@hospital.gr ')).toBe(true);
    expect(isValidEmail('maria@hospital')).toBe(false);
    expect(isValidEmail('maria hospital.gr')).toBe(false);
  });
});
