import {describe, expect, it} from 'vitest';
import {departments} from '../../core/libraries';
import {currentDemoView, demoDepartments, demoSessionUser} from '../demoRoles';

describe('demo roles', () => {
  it('offers every library department except the sterilization service', () => {
    const offered = demoDepartments(departments).map(d => d.code);
    expect(offered).not.toContain('STER');
    expect(offered).toHaveLength(departments.length - 1);
  });

  it('works as the chosen department', () => {
    const user = demoSessionUser('DEPARTMENT:delivery', departments);
    expect(user).toMatchObject({role: 'DEPARTMENT', department: 'Αίθουσα Τοκετών'});
    expect(currentDemoView(user.role, user, departments)).toBe('DEPARTMENT:delivery');
  });

  it('falls back to the first department when none is given', () => {
    expect(demoSessionUser('DEPARTMENT:', departments).department).toBe('Χειρουργείο');
  });

  it('maps sterilization to the sterilization service', () => {
    const user = demoSessionUser('STERILIZATION', departments);
    expect(user).toMatchObject({role: 'STERILIZATION', department: 'Κεντρική Αποστείρωση'});
    expect(currentDemoView(user.role, user, departments)).toBe('STERILIZATION');
  });
});
