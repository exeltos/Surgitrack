import {useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Plus, ChevronRight} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import AppButton from '../../components/ui/AppButton';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import PageHeader from '../../components/ui/PageHeader';
export default function SetsPage() {
  const {sets, tools, can} = useSurgi();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [state, setState] = useState('');
  const values = (key: 'department' | 'specialty' | 'manufacturer' | 'state') =>
    [...new Set(sets.map(s => String(s[key] || '')).filter(Boolean))].sort();
  const filtered = sets.filter(
    s =>
      (!department || s.department === department) &&
      (!specialty || s.specialty === specialty) &&
      (!manufacturer || s.manufacturer === manufacturer) &&
      (!state || s.state === state) &&
      `${s.barcode} ${s.name} ${s.code} ${s.manufacturer || ''} ${s.specialty} ${s.department}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow="ASSET MANAGEMENT"
        title="Σετ εργαλείων"
        description="Μητρώο Σετ με ξεχωριστά πεδία Ονομασίας, Κωδικού και μοναδικού Barcode."
        actions={
          can('asset.create') ? (
            <AppButton variant="primary" icon={<Plus size={17} />} onClick={() => navigate('/sets/new')}>
              Νέο Σετ
            </AppButton>
          ) : undefined
        }
      />
      <AssetFilterBar
        query={q}
        onQueryChange={setQ}
        placeholder="Όνομα Σετ, κωδικός ή barcode..."
        filters={[
          {
            key: 'department',
            value: department,
            placeholder: 'Όλα τα τμήματα',
            options: values('department').map(value => ({value, label: value})),
            onChange: setDepartment,
          },
          {
            key: 'specialty',
            value: specialty,
            placeholder: 'Όλες οι ειδικότητες',
            options: values('specialty').map(value => ({value, label: value})),
            onChange: setSpecialty,
          },
          {
            key: 'manufacturer',
            value: manufacturer,
            placeholder: 'Όλες οι εταιρείες',
            options: values('manufacturer').map(value => ({value, label: value})),
            onChange: setManufacturer,
          },
          {
            key: 'state',
            value: state,
            placeholder: 'Όλες οι καταστάσεις',
            options: values('state').map(value => ({value, label: value})),
            onChange: setState,
          },
        ]}
      />
      <ScrollableListPanel ariaLabel="Λίστα Σετ εργαλείων">
        <table className="asset-registry-table">
          <thead>
            <tr>
              <th>Όνομα Σετ</th>
              <th>Κωδικός</th>
              <th>Barcode</th>
              <th>Εταιρεία</th>
              <th>Τμήμα</th>
              <th>Ειδικότητα</th>
              <th>Εργαλεία</th>
              <th>Κατάσταση</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const count = tools.filter(t => t.setId === s.id).length;
              return (
                <tr key={s.id}>
                  <td>
                    <div className="registry-asset-name">
                      <AssetTypeIcon kind="SET" framed size={15} />
                      <span>
                        <Link className="row-title-link" to={`/sets/${s.id}`}>
                          {s.name}
                        </Link>
                      </span>
                    </div>
                  </td>
                  <td>{s.code}</td>
                  <td>
                    <Link className="mono strong-link" to={`/sets/${s.id}`}>
                      {s.barcode}
                    </Link>
                  </td>
                  <td>{s.manufacturer || '—'}</td>
                  <td>
                    {s.state === 'IN_STOCK' ? <span className="asset-field-na">Stock Σετ</span> : s.department || '—'}
                  </td>
                  <td>{s.specialty || '—'}</td>
                  <td>
                    <b>{count}</b>
                    <span className="muted"> / {s.expected}</span>
                  </td>
                  <td>
                    <StatusBadge value={s.state} />
                  </td>
                  <td>
                    <Link className="icon-link" to={`/sets/${s.id}`} aria-label={`Άνοιγμα ${s.barcode}`}>
                      <ChevronRight size={17} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollableListPanel>
    </div>
  );
}
