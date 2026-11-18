import {describe, expect, it} from 'vitest';
import {patientCodeRequired} from '../patientCode';

describe('the patient code rule', () => {
  it('is required only in the departments ticked', () => {
    const policy = {patientCodeDepartments: ['Χειρουργείο']};
    expect(patientCodeRequired('Χειρουργείο', policy)).toBe(true);
    expect(patientCodeRequired('ΜΕΘ', policy)).toBe(false);
    expect(patientCodeRequired(undefined, policy)).toBe(false);
    expect(patientCodeRequired('Χειρουργείο', {})).toBe(false);
  });
});
