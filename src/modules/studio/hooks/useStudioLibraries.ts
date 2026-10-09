import {useMemo} from 'react';
import {roles, libraryMeta} from '../studioMeta';
import {activeHospitalId} from '../../../data/cloud/hospitalSwitch';
import type {Tab} from '../studioMeta';
import type {useStudioState} from './useStudioState';
import type {useStudioCloud} from './useStudioCloud';
import type {useStudioOrganizations} from './useStudioOrganizations';

export function useStudioLibraries(
  p: ReturnType<typeof useStudioState> & ReturnType<typeof useStudioCloud> & ReturnType<typeof useStudioOrganizations>,
) {
  const {cloudDepartments, displayedUsers, libraryKey, libs, query, setQuery, setTab} = p;

  const currentMeta = libraryMeta.find(x => x.key === libraryKey)!;
  const currentItems =
    libs.dataMode === 'PRODUCTION' && libraryKey === 'departments'
      ? cloudDepartments.map(d => ({id: d.id, el: d.name, en: d.name, code: d.code}))
      : libs[libraryKey];
  const filteredItems = currentItems.filter(x =>
    `${x.el} ${x.en} ${x.code || ''}`.toLowerCase().includes(query.toLowerCase()),
  );
  const roleCount = useMemo(() => {
    // The platform owner loads every hospital's users; the counts are for the hospital in view.
    const hospital = activeHospitalId();
    const here = hospital ? displayedUsers.filter(u => u.organizationId === hospital) : displayedUsers;
    return roles.map(r => ({role: r.id, count: here.filter(u => u.role === r.id && u.active).length}));
  }, [displayedUsers]);
  const resetQuery = () => setQuery('');
  const selectTab = (next: Tab) => {
    setTab(next);
    resetQuery();
  };
  return {currentMeta, filteredItems, resetQuery, roleCount, selectTab};
}
