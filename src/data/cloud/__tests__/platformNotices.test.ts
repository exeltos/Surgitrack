import {describe, expect, it} from 'vitest';
import {noticeStatus, type PlatformNotice} from '../platformNotices';

const now = Date.parse('2026-10-10T10:00:00Z');
const notice = (startsAt: string, endsAt?: string): PlatformNotice => ({
  id: 'n',
  message: 'Συντήρηση',
  startsAt,
  endsAt,
  createdAt: startsAt,
});

describe('a notice to every user', () => {
  it('shows from its start until its end', () => {
    expect(noticeStatus(notice('2026-10-10T09:00:00Z', '2026-10-10T11:00:00Z'), now)).toBe('ACTIVE');
  });
  it('without an end it shows until it is ended', () => {
    expect(noticeStatus(notice('2026-10-01T09:00:00Z'), now)).toBe('ACTIVE');
  });
  it('is scheduled before its start and over at its end', () => {
    expect(noticeStatus(notice('2026-10-10T12:00:00Z'), now)).toBe('SCHEDULED');
    expect(noticeStatus(notice('2026-10-09T09:00:00Z', '2026-10-10T10:00:00Z'), now)).toBe('ENDED');
  });
});
