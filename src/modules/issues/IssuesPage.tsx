import {useState} from 'react';
import {Images} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import PageHeader from '../../components/ui/PageHeader';

export default function IssuesPage() {
  const {issues, role, currentUser} = useSurgi();
  const scopedIssues =
    role === 'DEPARTMENT' ? issues.filter(issue => issue.department === currentUser.department) : issues;
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const values = (key: 'department' | 'type' | 'status') =>
    [...new Set(scopedIssues.map(i => i[key]).filter(Boolean))].sort();
  const filtered = scopedIssues.filter(
    i =>
      (!department || i.department === department) &&
      (!type || i.type === type) &&
      (!status || i.status === status) &&
      `${i.asset} ${i.type} ${i.department} ${i.note}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="tools-list-workspace">
      <PageHeader
        title="Εκκρεμότητες"
        description={
          role === 'DEPARTMENT'
            ? `Αναφορές και εκκρεμότητες του τμήματος ${currentUser.department}.`
            : 'Ενιαία διαχείριση ελλείψεων, φθορών, βλαβών, απωλειών, service και αντικαταστάσεων.'
        }
      />
      <AssetFilterBar
        query={q}
        onQueryChange={setQ}
        placeholder="Εργαλείο/Σετ, barcode, τύπος ή σημείωση..."
        filters={[
          ...(role === 'DEPARTMENT'
            ? []
            : [
                {
                  key: 'department',
                  value: department,
                  placeholder: 'Όλα τα τμήματα',
                  options: values('department').map(value => ({value, label: value})),
                  onChange: setDepartment,
                },
              ]),
          {
            key: 'type',
            value: type,
            placeholder: 'Όλοι οι τύποι',
            options: values('type').map(value => ({value, label: value})),
            onChange: setType,
          },
          {
            key: 'status',
            value: status,
            placeholder: 'Όλες οι καταστάσεις',
            options: [
              {value: 'OPEN', label: 'Ανοικτές'},
              {value: 'RESOLVED', label: 'Επιλυμένες'},
            ],
            onChange: setStatus,
          },
        ]}
      />
      <ScrollableListPanel ariaLabel="Λίστα εκκρεμοτήτων">
        <table className="asset-registry-table issues-registry-table">
          <thead>
            <tr>
              <th>Αντικείμενο</th>
              <th>Τύπος</th>
              <th>Τμήμα</th>
              <th>Δημιουργήθηκε</th>
              <th>Σημείωση</th>
              <th>Φωτογραφίες</th>
              <th>Κατάσταση</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(i => (
              <tr key={i.id}>
                <td>
                  <strong>{i.asset}</strong>
                </td>
                <td>{i.type}</td>
                <td>{i.department}</td>
                <td>{i.created}</td>
                <td>{i.note}</td>
                <td>
                  {i.photos?.length ? (
                    <div className="issue-table-photos">
                      {i.photos.slice(0, 3).map(photo => (
                        <img key={photo.id} src={photo.dataUrl} alt={photo.name} />
                      ))}
                      {i.photos.length > 3 && <span>+{i.photos.length - 3}</span>}
                    </div>
                  ) : (
                    <span className="issue-no-photo">
                      <Images size={14} />—
                    </span>
                  )}
                </td>
                <td>
                  <span className={`badge ${i.status === 'OPEN' ? 'warning' : ''}`}>
                    {i.status === 'OPEN' ? 'Ανοικτή' : 'Επιλυμένη'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollableListPanel>
    </div>
  );
}
