import {usePeopleState} from './usePeopleState';
import {usePeopleData} from './usePeopleData';
import {usePeopleView} from './usePeopleView';
import {usePeopleDecisions} from './usePeopleDecisions';
import {usePeopleDepartments} from './usePeopleDepartments';
import {usePeopleMembers} from './usePeopleMembers';
import {usePeopleCsv} from './usePeopleCsv';

/** The people screen's state and actions, built piece by piece; each hook gets what the ones before it returned. */
export function usePeople(props: {
  organizationId?: string;
  /** The platform owner: may also give Demo access. */
  platform?: boolean;
  /** The hospital opens Demo, so its users may get Demo access. */
  hospitalDemo?: boolean;
  refreshKey?: number;
  onChanged?: () => void;
}) {
  const s0 = usePeopleState(props);
  const s1 = {...s0, ...usePeopleData(s0)};
  const s2 = {...s1, ...usePeopleView(s1)};
  const s3 = {...s2, ...usePeopleDecisions(s2)};
  const s4 = {...s3, ...usePeopleDepartments(s3)};
  const s5 = {...s4, ...usePeopleMembers(s4)};
  const s6 = {...s5, ...usePeopleCsv(s5)};
  return s6;
}

export type PeopleState = ReturnType<typeof usePeople>;
