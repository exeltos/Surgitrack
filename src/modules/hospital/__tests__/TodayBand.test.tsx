import {render, screen, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {describe, expect, it} from 'vitest';
import {AppPreferencesProvider} from '../../../core/AppPreferences';
import {isoDate} from '../../../core/sterileExpiry';
import type {ProcessLoadRecord} from '../../../types/domain';
import TodayBand from '../TodayBand';

const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const today = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} 08:15`;
const load = (id: string, kind: 'STERILIZATION' | 'WASHING') => ({id, kind, createdAt: today}) as ProcessLoadRecord;

const band = (next?: {title: string; to: string}) =>
  render(
    <MemoryRouter>
      <AppPreferencesProvider>
        <TodayBand
          incoming={6}
          inProcess={20}
          inSterilizer={2}
          ready={7}
          next={next}
          processLoads={[load('a', 'STERILIZATION'), load('b', 'STERILIZATION'), load('c', 'WASHING')]}
          expiries={[{sterileUntil: isoDate(now)}]}
        />
      </AppPreferencesProvider>
    </MemoryRouter>,
  );

describe('the Overview’s «Σήμερα»', () => {
  it('counts today, each count opening its queue, and leads to the first thing to do', () => {
    band({title: '4 έληξαν', to: '/expiry'});
    expect(screen.getByRole('link', {name: 'Προς παραλαβή: 6'})).toHaveAttribute(
      'href',
      '/sterilization?queue=INCOMING',
    );
    expect(screen.getByRole('link', {name: 'Στον κλίβανο: 2'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: /Πρώτα: 4 έληξαν/})).toHaveAttribute('href', '/expiry');
  });

  it('shows this week, today marked, with today’s sterilization cycles and what expires', () => {
    band();
    const week = screen.getByRole('list', {name: 'Αυτή την εβδομάδα'});
    expect(within(week).getAllByRole('listitem')).toHaveLength(7);
    const day = week.querySelector('[aria-current="date"]') as HTMLElement;
    expect(day).toHaveTextContent('2 κύκλοι αποστείρωσης, 1 λήγουν');
    expect(screen.getByText('Τίποτα δεν περιμένει.')).toBeInTheDocument();
  });
});
