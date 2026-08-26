import type {ReactNode} from 'react';
import {useSurgi} from '../../store/SurgiStore';
import type {Permission} from '../../core/permissions';

export default function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const {can} = useSurgi();
  return can(permission) ? <>{children}</> : <>{fallback}</>;
}
