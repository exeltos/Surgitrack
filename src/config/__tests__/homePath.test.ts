import {describe, expect, it} from 'vitest';
import {homePathFor} from '../navigation';

describe('home after sign-in', () => {
  it('opens the Overview for roles whose menu has it, else the first menu entry', () => {
    expect(homePathFor('ADMIN')).toBe('/overview');
    expect(homePathFor('DEPARTMENT')).toBe('/department');
    // Sterilization: the supervisor has the Overview; a Sterilization user starts on Sterilization.
    expect(homePathFor('STERILIZATION', () => true)).toBe('/overview');
    expect(homePathFor('STERILIZATION')).toBe('/sterilization');
  });
});
