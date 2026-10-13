import {describe, expect, it} from 'vitest';
import type {DemoAccount} from '../demoAccounts';
import {ratingKind, summarizeRatings} from '../demoRatings';

const demo = (hospitalName: string, over: Partial<DemoAccount>): DemoAccount =>
  ({hospitalName, ratings: [], evaluations: [], requests: [], ...over}) as unknown as DemoAccount;

describe('the owner’s view of Demo ratings', () => {
  it('tells a step, a tour, a screen and a part of the app apart', () => {
    expect(['step_receive', 'tour_receive', 'screen_sets', 'sterilization'].map(ratingKind)).toEqual([
      'STEP',
      'TOUR',
      'SCREEN',
      'MODULE',
    ]);
  });

  it('averages each topic over every Demo, weighted by how many rated it, with the comments', () => {
    const summary = summarizeRatings([
      demo('Λάρισα', {ratings: [{topic: 'tour_receive', average: 4, count: 3, comments: ['Καθαρό']}]}),
      demo('Βόλος', {ratings: [{topic: 'tour_receive', average: 2, count: 1, comments: []}]}),
    ]);
    const tour = summary.ratings.find(r => r.topic === 'tour_receive')!;
    expect(tour.average).toBe(3.5);
    expect(tour.count).toBe(4);
    expect(tour.comments).toEqual([{hospital: 'Λάρισα', text: 'Καθαρό'}]);
    expect(summary.average).toBe(3.5);
  });

  it('gives the NPS as promoters minus detractors, and counts the requests waiting', () => {
    const evaluation = (nps: number) => ({name: 'x', nps});
    const summary = summarizeRatings([
      demo('Λάρισα', {
        evaluations: [evaluation(10), evaluation(9), evaluation(3), evaluation(8)],
        requests: [
          {id: '1', kind: 'PURCHASE', name: 'x', status: 'NEW', createdAt: ''},
          {id: '2', kind: 'EXTENSION', name: 'x', status: 'HANDLED', createdAt: ''},
        ],
      }),
    ]);
    expect(summary.nps).toBe(25);
    expect(summary.newRequests).toBe(1);
    expect(summarizeRatings([]).nps).toBeUndefined();
  });
});

describe('ratings by part of the app', () => {
  it('puts a part’s own, step, tour and screen ratings together, the low parts first, newest first', async () => {
    const {ratingPart, ratingsByPart} = await import('../demoRatings');
    expect(
      ['sterilization', 'step_receive', 'tour_release', 'screen_sterilization', 'screen_sets'].map(ratingPart),
    ).toEqual(['sterilization', 'sterilization', 'sterilization', 'sterilization', 'other']);
    const parts = ratingsByPart([
      demo('Λάρισα', {
        feedback: [
          {topic: 'step_receive', name: 'Α', rating: 5, at: '2026-10-01T00:00:00Z'},
          {topic: 'tour_cycle', name: 'Β', rating: 3, at: '2026-10-03T00:00:00Z'},
          {topic: 'screen_reports', name: 'Α', rating: 2, at: '2026-10-02T00:00:00Z'},
        ],
      }),
    ]);
    expect(parts.map(p => p.key)).toEqual(['reports', 'sterilization']);
    const sterilization = parts.find(p => p.key === 'sterilization')!;
    expect(sterilization.average).toBe(4);
    expect(sterilization.entries.map(e => e.name)).toEqual(['Β', 'Α']);
    expect(sterilization.entries[0].hospital).toBe('Λάρισα');
  });
});
