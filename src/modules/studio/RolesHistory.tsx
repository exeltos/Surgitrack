import {History} from 'lucide-react';
import {formatDateTime} from '../../core/displayDate';
import {useLibraries} from '../../core/LibraryStore';
import {roles} from './studioMeta';

/** Every change to the roles' permissions, newest first: when, by whom, which role and how many permissions. */
export default function RolesHistory({L}: {L: (el: string, en: string) => string}) {
  const {rolePermissionAudit = []} = useLibraries();
  const entries = [...rolePermissionAudit].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const roleName = (id: string) => {
    const role = roles.find(r => r.id === id);
    return role ? L(role.el, role.en) : id;
  };
  return (
    <section className="roles-history">
      {entries.length === 0 ? (
        <div className="studio-empty">
          <History size={22} aria-hidden="true" />
          {L('Δεν υπάρχουν ακόμη αλλαγές στα δικαιώματα.', 'No changes to the permissions yet.')}
        </div>
      ) : (
        <table className="roles-history-table">
          <thead>
            <tr>
              <th>{L('Πότε', 'When')}</th>
              <th>{L('Ρόλος', 'Role')}</th>
              <th>{L('Από', 'By')}</th>
              <th>{L('Δικαιώματα', 'Permissions')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(entry => (
              <tr key={entry.id}>
                <td>{formatDateTime(entry.at)}</td>
                <td>
                  <b>{roleName(entry.role)}</b>
                </td>
                <td>{entry.by}</td>
                <td>{entry.permissions.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
