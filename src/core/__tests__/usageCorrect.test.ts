import {describe, expect, it} from 'vitest';
import {hasPermission} from '../permissions';

describe('correcting uses by hand', () => {
  it('is apart from setting the limits: only the admin and the Sterilization supervisor', () => {
    expect(hasPermission('ADMIN', 'asset.usage.correct')).toBe(true);
    expect(hasPermission('STERILIZATION', 'asset.usage.correct', undefined, true)).toBe(true);
    // A Sterilization user who is not the supervisor, a department or a viewer: never, whatever the role settings.
    expect(hasPermission('STERILIZATION', 'asset.usage.correct')).toBe(false);
    expect(hasPermission('STERILIZATION', 'asset.usage.correct', {STERILIZATION: ['asset.usage.correct']})).toBe(false);
    expect(hasPermission('DEPARTMENT', 'asset.usage.correct', {DEPARTMENT: ['asset.usage.correct']})).toBe(false);
    expect(hasPermission('VIEWER', 'asset.usage.correct', {VIEWER: ['asset.usage.correct']})).toBe(false);
  });
});
