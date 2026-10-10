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
