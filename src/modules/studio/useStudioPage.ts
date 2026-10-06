import {useStudioState} from './hooks/useStudioState';
import {useStudioCloud} from './hooks/useStudioCloud';
import {useStudioOrganizations} from './hooks/useStudioOrganizations';
import {useStudioLibraries} from './hooks/useStudioLibraries';
import {useStudioRoles} from './hooks/useStudioRoles';

/** Everything the Studio screen needs, built piece by piece; each hook gets what the ones before it returned. */
export function useStudioPage() {
  const s0 = useStudioState();
  const s1 = {...s0, ...useStudioCloud(s0)};
  const s2 = {...s1, ...useStudioOrganizations(s1)};
  const s3 = {...s2, ...useStudioLibraries(s2)};
  const s4 = {...s3, ...useStudioRoles(s3)};
  return s4;
}

export type StudioPageState = ReturnType<typeof useStudioPage>;
