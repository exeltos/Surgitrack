import {useState} from 'react';
import RolesGuide from './RolesGuide';
import RolesTab from './tabs/RolesTab';
import type {StudioPageState} from './useStudioPage';

/**
 * Roles and permissions: each role's permissions to change, or who does what. In Studio («Ρόλοι & δικαιώματα»)
 * and in the hospital's Organization page, next to its users and departments.
 */
export default function RolesSection({s}: {s: StudioPageState}) {
  const {L, platformAdmin} = s;
  const [view, setView] = useState<'PERMISSIONS' | 'GUIDE'>('PERMISSIONS');
  return (
    <>
      <div className="settings-categories" role="group" aria-label={L('Προβολή', 'View')}>
        <button
          type="button"
          aria-pressed={view === 'PERMISSIONS'}
          className={`settings-category ${view === 'PERMISSIONS' ? 'active' : ''}`}
          onClick={() => setView('PERMISSIONS')}
        >
          {L('Δικαιώματα ανά ρόλο', 'Permissions by role')}
        </button>
        <button
          type="button"
          aria-pressed={view === 'GUIDE'}
          className={`settings-category ${view === 'GUIDE' ? 'active' : ''}`}
          onClick={() => setView('GUIDE')}
        >
          {L('Ποιος κάνει τι', 'Who does what')}
        </button>
      </div>
      {view === 'GUIDE' ? (
        <div className="roles-guide-scroll">
          <RolesGuide owner={platformAdmin} />
        </div>
      ) : (
        <RolesTab s={{...s, tab: 'ROLES'}} />
      )}
    </>
  );
}
