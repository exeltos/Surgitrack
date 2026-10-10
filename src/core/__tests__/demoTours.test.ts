import {describe, expect, it} from 'vitest';
import {guideSteps} from '../demoGuide';
import {screenTopic, tourFor, tourOrScreenTitle, tourTopic} from '../demoTours';

// What demo_guide_progress.step_key and demo_feedback.topic accept.
const KEY = /^[a-z_]{2,40}$/;

describe('guided tours of an evaluation Demo', () => {
  it('every Sterilization step of the administrator has a tour, on the step’s own screen', () => {
    for (const step of guideSteps('ADMIN')) {
      const tour = tourFor(step.key);
      expect(tour, step.key).toBeDefined();
      expect(tour!.to).toBe(step.to);
      expect(tour!.stops.length).toBeGreaterThan(0);
    }
  });
  it('keeps its progress and rating under keys the database accepts', () => {
    for (const step of guideSteps('ADMIN')) expect(tourTopic(step.key)).toMatch(KEY);
    for (const path of ['/sterilization', '/standalone-tools', '/sets/abc-123', '/', '/tools/new'])
      expect(screenTopic(path)).toMatch(KEY);
    expect(screenTopic('/standalone-tools')).toBe('screen_standalone_tools');
    expect(screenTopic('/sets/abc-123')).toBe('screen_sets');
  });
  it('names a tour or screen rating for the platform owner', () => {
    const title = (key: string) => (key === 'receive' ? {el: 'Παραλαβή', en: 'Receipt'} : undefined);
    expect(tourOrScreenTitle('tour_receive', title)?.el).toBe('Ξενάγηση · Παραλαβή');
    expect(tourOrScreenTitle('screen_sets', title)?.el).toBe('Οθόνη · Σετ εργαλείων');
    expect(tourOrScreenTitle('step_receive', title)).toBeUndefined();
  });
});
