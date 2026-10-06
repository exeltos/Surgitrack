import {useMemo} from 'react';
import {roles, libraryMeta} from '../studioMeta';
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
  const roleCount = useMemo(
    () => roles.map(r => ({role: r.id, count: displayedUsers.filter(u => u.role === r.id && u.active).length})),
    [displayedUsers],
  );
  const resetQuery = () => setQuery('');
  const selectTab = (next: Tab) => {
    setTab(next);
    resetQuery();
  };
  return {currentMeta, filteredItems, resetQuery, roleCount, selectTab};
}
