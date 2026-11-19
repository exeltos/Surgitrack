import {movementStamp} from '../../core/movementTime';
import {isDispatch} from '../department/departmentStatus';
import {undoneIds} from '../../core/movementUndo';
import type {Issue, Movement, ProcessLoadRecord} from '../../types/domain';

/** The indicators' period: from `since` (a timestamp) to now. */
export const sinceDays = (days: number, now = new Date()) => {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.getTime();
};

const stampOf = (at?: string) => (at ? movementStamp(at) : 0);
/** Monday 0 … Sunday 6. */
const weekdayOf = (stamp: number) => (new Date(stamp).getDay() + 6) % 7;

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
export const percentile = (values: number[], p: number) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

/** Live movements in the period: an undo, what it undid and what that caused (a retirement at a dispatch) count as
 * nothing. */
export function liveMovements(movements: readonly Movement[], since: number) {
  const undone = undoneIds(movements);
  return movements.filter(m => !m.undoes && !undone.has(m.id) && stampOf(m.at) >= since);
}

/**
 * Workload: every movement in the period by weekday (rows, Monday first) and hour (columns), with the busiest hour,
 * the busiest weekday and the average per day over the period's `days` calendar days (today included).
 */
export function workload(movements: readonly Movement[], since: number, days: number) {
  const grid = Array.from({length: 7}, () => Array.from({length: 24}, () => 0));
  const byHour = Array.from({length: 24}, () => 0);
  const byDay = Array.from({length: 7}, () => 0);
  let total = 0;
  for (const m of movements) {
    const stamp = stampOf(m.at);
    if (!stamp || stamp < since) continue;
    const d = weekdayOf(stamp);
    const h = new Date(stamp).getHours();
    grid[d][h]++;
    byHour[h]++;
    byDay[d]++;
    total++;
  }
  const peakHour = total ? byHour.indexOf(Math.max(...byHour)) : undefined;
  const peakDay = total ? byDay.indexOf(Math.max(...byDay)) : undefined;
  return {
    grid,
    byHour,
    byDay,
    total,
    perDay: total / Math.max(1, days),
    peakHour,
    peakDay,
    max: Math.max(0, ...grid.flat()),
  };
}

/** Each sterilizer and washer in the period: its cycles, the failed ones and the busiest weekday. */
export function equipmentLoad(loads: readonly ProcessLoadRecord[], since: number) {
  const rows = new Map<
    string,
    {name: string; kind: ProcessLoadRecord['kind']; cycles: number; failed: number; byDay: number[]}
  >();
  for (const load of loads) {
    const stamp = stampOf(load.createdAt);
    if (!stamp || stamp < since) continue;
    const row = rows.get(load.equipment) || {
      name: load.equipment,
      kind: load.kind,
      cycles: 0,
      failed: 0,
      byDay: Array.from({length: 7}, () => 0),
    };
    row.cycles++;
    if (load.status === 'FAILED' || load.status === 'REPROCESS' || load.status === 'RECALLED') row.failed++;
    row.byDay[weekdayOf(stamp)]++;
    rows.set(load.equipment, row);
  }
  return [...rows.values()]
    .map(r => ({...r, peakDay: r.byDay.indexOf(Math.max(...r.byDay))}))
    .sort((a, b) => b.cycles - a.cycles);
}

/**
 * Turnaround per department: from the department's dispatch to Sterilization until the Set or instrument is back in
 * the department, in hours (median and the slowest tenth).
 */
export function turnaround(movements: readonly Movement[], since: number) {
  // An undo and what it undid are no move: an undone dispatch is no round, the undo itself no return.
  const byAsset = new Map<string, Array<{m: Movement; stamp: number}>>();
  for (const m of liveMovements(movements, 0)) {
    const stamp = stampOf(m.at);
    if (!stamp) continue;
    const code = m.asset.split(' · ')[0].trim().toUpperCase();
    byAsset.set(code, [...(byAsset.get(code) || []), {m, stamp}]);
  }
  const hours = new Map<string, number[]>();
  for (const trail of byAsset.values()) {
    trail.sort((a, b) => a.stamp - b.stamp);
    trail.forEach(({m, stamp}, i) => {
      if (stamp < since || !isDispatch(m, m.from)) return;
      const back = trail.slice(i + 1).find(x => x.m.to === m.from);
      if (!back) return;
      hours.set(m.from, [...(hours.get(m.from) || []), (back.stamp - stamp) / 3_600_000]);
    });
  }
  const all = [...hours.values()].flat();
  return {
    overall: {median: median(all), p90: percentile(all, 90), rounds: all.length},
    departments: [...hours.entries()]
      .map(([department, h]) => ({department, median: median(h), p90: percentile(h, 90), rounds: h.length}))
      .sort((a, b) => b.median - a.median),
  };
}

/**
 * Use: the movements recorded with a patient code in the period, by department (uses and patients), and the Sets
 * (by name: the kind of operation) used most, overall and in each department.
 */
export function usage(movements: readonly Movement[], since: number) {
  const departments = new Map<
    string,
    {department: string; uses: number; patients: Set<string>; kinds: Map<string, number>}
  >();
  const kinds = new Map<string, number>();
  // One use is one Set or instrument on one patient: the count signed for it, its dispatch, a recall or a retirement
  // may each carry the same patient code.
  const seen = new Set<string>();
  for (const m of movements) {
    // A record another one caused (an instrument retired as its Set is dispatched, «from» the Set) is no use of its own.
    if (!m.patientCode || m.causedBy || stampOf(m.at) < since) continue;
    const use = `${m.asset.split(' · ')[0].trim().toUpperCase()}|${m.patientCode}`;
    if (seen.has(use)) continue;
    seen.add(use);
    const department = m.from;
    const name = (m.asset.split(' · ')[1] || m.asset).trim();
    const row = departments.get(department) || {department, uses: 0, patients: new Set(), kinds: new Map()};
    row.uses++;
    row.patients.add(m.patientCode);
    row.kinds.set(name, (row.kinds.get(name) || 0) + 1);
    departments.set(department, row);
    kinds.set(name, (kinds.get(name) || 0) + 1);
  }
  const top = (map: Map<string, number>, n: number) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, uses]) => ({name, uses}));
  return {
    departments: [...departments.values()]
      .map(d => ({department: d.department, uses: d.uses, patients: d.patients.size, top: top(d.kinds, 3)}))
      .sort((a, b) => b.uses - a.uses),
    kinds: top(kinds, 10),
  };
}

/** Quality in the period: cycles that failed, were reprocessed or recalled, of all the sterilization cycles. */
export function quality(loads: readonly ProcessLoadRecord[], since: number) {
  const inPeriod = loads.filter(l => stampOf(l.createdAt) >= since);
  const sterilization = inPeriod.filter(l => l.kind === 'STERILIZATION');
  const count = (status: ProcessLoadRecord['status']) => sterilization.filter(l => l.status === status).length;
  return {
    cycles: sterilization.length,
    washes: inPeriod.length - sterilization.length,
    failed: count('FAILED'),
    reprocess: count('REPROCESS'),
    // A recall belongs to the day it was made, not to the cycle's: a load from before the period may be recalled in it.
    recalled: loads.filter(l => l.status === 'RECALLED' && stampOf(l.recalledAt || l.createdAt) >= since).length,
  };
}

/** Issues raised in the period, by type and by department. */
export function issueCounts(issues: readonly Issue[], since: number) {
  const inPeriod = issues.filter(i => stampOf(i.created) >= since);
  const tally = (key: (i: Issue) => string) => {
    const map = new Map<string, number>();
    for (const i of inPeriod) map.set(key(i), (map.get(key(i)) || 0) + 1);
    return [...map.entries()].map(([name, n]) => ({name, n})).sort((a, b) => b.n - a.n);
  };
  return {
    total: inPeriod.length,
    open: inPeriod.filter(i => i.status === 'OPEN').length,
    byType: tally(i => i.type),
    byDepartment: tally(i => i.department),
  };
}
