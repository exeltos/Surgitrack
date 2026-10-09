import {describe, expect, it} from 'vitest';
import {briefingFor, greekVocative, type BriefingInput} from '../briefing';
import type {Issue, ProcessLoadRecord, SetAsset, Tool} from '../../types/domain';
import type {ExpiryEntry} from '../sterileExpiry';

const set = (id: string, department: string, state: SetAsset['state']) => ({id, department, state}) as SetAsset;
const tool = (id: string, department: string, state: Tool['state'], mode: Tool['mode'] = 'STANDALONE') =>
  ({id, department, state, mode}) as Tool;
const issue = (department: string, status: Issue['status'] = 'OPEN') => ({department, status}) as Issue;
const load = (status: ProcessLoadRecord['status'], bio?: ProcessLoadRecord['biologicalIndicatorResult']) =>
  ({kind: 'STERILIZATION', status, biologicalIndicatorResult: bio}) as ProcessLoadRecord;
const exp = (id: string, state: ExpiryEntry['state']) => ({id, state}) as ExpiryEntry;

const base: BriefingInput = {
  role: 'DEPARTMENT',
  department: 'ORL',
  sets: [
    set('s1', 'ORL', 'READY_FOR_PICKUP'),
    set('s2', 'EYE', 'READY_FOR_PICKUP'),
    set('s3', 'ORL', 'PENDING_STERILIZATION'),
  ],
  tools: [tool('t1', 'ORL', 'READY_FOR_PICKUP'), tool('t2', 'ORL', 'READY_FOR_PICKUP', 'SET_MEMBER')],
  issues: [issue('ORL'), issue('EYE'), issue('ORL', 'RESOLVED')],
  processLoads: [load('AWAITING_RELEASE'), load('RELEASED', 'PENDING'), load('RELEASED', 'PASS')],
  expiry: [exp('s1', 'EXPIRED'), exp('s2', 'EXPIRING'), exp('t1', 'EXPIRING')],
  outOfUse: 2,
  accessRequests: 1,
  belowMinimum: 3,
  screens: ['/department', '/issues', '/sterilization', '/tools', '/expiry', '/stock', '/hospital'],
};
const counts = (input: BriefingInput) => Object.fromEntries(briefingFor(input).map(i => [i.key, i.count]));

describe('briefing at sign-in', () => {
  it('shows the department only its own Sets and instruments', () => {
    expect(counts(base)).toEqual({ready: 2, expired: 1, expiring: 1, issues: 1});
  });

  it('gives Sterilization its work queue', () => {
    expect(counts({...base, role: 'STERILIZATION'})).toEqual({
      receive: 1,
      release: 1,
      biological: 1,
      outOfUse: 2,
      access: 1,
      expired: 1,
      expiring: 2,
      stock: 3,
      issues: 2,
    });
  });

  it('gives the admin what needs a decision, not the sterilization queue', () => {
    expect(Object.keys(counts({...base, role: 'ADMIN'}))).toEqual(['access', 'expired', 'expiring', 'stock', 'issues']);
  });

  it('leaves out what is zero and what the person cannot open', () => {
    const keys = Object.keys(counts({...base, role: 'ADMIN', accessRequests: 0, screens: ['/issues', '/expiry']}));
    expect(keys).toEqual(['expired', 'expiring', 'issues']);
  });

  it('addresses Greek first names', () => {
    expect(greekVocative('Νίκος')).toBe('Νίκο');
    expect(greekVocative('Αριστείδης')).toBe('Αριστείδη');
    expect(greekVocative('Ηλίας')).toBe('Ηλία');
    expect(greekVocative('Μαρία')).toBe('Μαρία');
    expect(greekVocative('John')).toBe('John');
  });
});
