import HospitalPeople from '../../hospital/HospitalPeople';
import type {StudioPageState} from '../useStudioPage';

export default function UsersTab({s}: {s: StudioPageState}) {
  const {
    L,
    displayedOrganizations,
    loadCloudDepartments,
    loadCloudUsers,
    platformAdmin,
    selectedOrganization,
    selectedOrganizationId,
    setSelectedOrganizationId,
    tab,
  } = s;
  return (
    <>
      {tab === 'USERS' && platformAdmin && (
        <section className="studio-manager-panel studio-users-panel">
          <header className="studio-panel-head">
            <div>
              <span className="eyebrow">{L('ΧΡΗΣΤΕΣ', 'USERS')}</span>
              <h2>{selectedOrganization ? selectedOrganization.name : L('Χρήστες νοσοκομείου', 'Hospital users')}</h2>
              <p>
                {selectedOrganization
                  ? L(
                      'Χρήστες, προσκλήσεις και τμήματα του νοσοκομείου.',
                      "The hospital's users, invitations and departments.",
                    )
                  : L('Επιλέξτε νοσοκομείο.', 'Select a hospital.')}
              </p>
            </div>
            <select value={selectedOrganizationId} onChange={e => setSelectedOrganizationId(e.target.value)}>
              <option value="">{L('Επιλογή νοσοκομείου', 'Select hospital')}</option>
              {displayedOrganizations.map(o => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </header>
          {selectedOrganization && (
            <HospitalPeople
              key={selectedOrganization.id}
              organizationId={selectedOrganization.id}
              platform
              hospitalDemo={selectedOrganization.demoEnabled}
              onChanged={() => {
                void loadCloudUsers();
                void loadCloudDepartments();
              }}
            />
          )}
        </section>
      )}
    </>
  );
}
