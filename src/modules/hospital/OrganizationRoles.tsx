import RolesSection from '../studio/RolesSection';
import {useStudioPage} from '../studio/useStudioPage';

/** The hospital's roles and permissions, in its Organization page (the same as Studio's). */
export default function OrganizationRoles() {
  const s = useStudioPage();
  return (
    <div className="studio-body studio-body-roles">
      <RolesSection s={s} />
    </div>
  );
}
