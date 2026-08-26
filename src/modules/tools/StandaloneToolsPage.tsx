import {useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {ChevronRight, Layers3, List, Plus} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import AppButton from '../../components/ui/AppButton';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import PageHeader from '../../components/ui/PageHeader';
import IconToggleButton from '../../components/ui/IconToggleButton';
import KpiStrip from '../../components/ui/KpiStrip';

export default function StandaloneToolsPage() {
  const {tools, can} = useSurgi();
  const navigate = useNavigate();
  const standalone = tools.filter(t => t.mode === 'STANDALONE');
  const [q, setQ] = useState('');
  const [grouped, setGrouped] = useState(false);
  const [department, setDepartment] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [state, setState] = useState('');
  const values = (key: 'department' | 'specialty' | 'manufacturer' | 'state') =>
    [...new Set(standalone.map(t => String(t[key] || '')).filter(Boolean))].sort();
  const filtered = standalone.filter(
    t =>
      (!department || t.department === department) &&
      (!specialty || t.specialty === specialty) &&
      (!manufacturer || t.manufacturer === manufacturer) &&
      (!state || t.state === state) &&
      `${t.name} ${t.code} ${t.barcode} ${t.department || ''} ${t.manufacturer} ${t.specialty}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const groups = useMemo(() => {
    const m = new Map<string, typeof tools>();
    filtered.forEach(t => {
      const k = `${t.code}|${t.name}|${t.manufacturer}`;
      m.set(k, [...(m.get(k) || []), t]);
    });
    return [...m.values()];
  }, [filtered]);
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow="ΛΕΙΤΟΥΡΓΙΚΗ ΛΙΣΤΑ"
        title="Μεμονωμένα εργαλεία σε χρήση"
        description="Μόνο φυσικά εργαλεία που χρησιμοποιούνται αυτόνομα σε τμήματα και δεν ανήκουν αυτή τη στιγμή σε Σετ."
        actions={
          can('asset.create') ? (
            <AppButton variant="primary" icon={<Plus size={17} />} onClick={() => navigate('/tools/new')}>
              Νέο Εργαλείο
            </AppButton>
          ) : undefined
        }
      />
      <KpiStrip
        compact
        items={[
          {label: 'Σε χρήση', value: standalone.length},
          {label: 'Τμήματα', value: new Set(standalone.map(t => t.department).filter(Boolean)).size},
          {label: 'Περιορισμένων χρήσεων', value: standalone.filter(t => t.maxUses).length},
          {
            label: '≤ 3 χρήσεις',
            value: standalone.filter(t => t.maxUses !== undefined && t.maxUses - t.uses <= 3).length,
          },
        ]}
      />
      <div className="asset-list-controls">
        <AssetFilterBar
          query={q}
          onQueryChange={setQ}
          placeholder="Ονομασία, κωδικός ή barcode..."
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
        <IconToggleButton
          active={grouped}
          activeIcon={<List size={17} />}
          inactiveIcon={<Layers3 size={17} />}
          activeTitle="Εμφάνιση φυσικών εγγραφών"
          inactiveTitle="Ομαδοποίηση ίδιων εργαλείων"
          onClick={() => setGrouped(v => !v)}
        />
      </div>
      <ScrollableListPanel withKpis ariaLabel="Μεμονωμένα εργαλεία σε χρήση">
        <table className="asset-registry-table">
          <thead>
            <tr>
              <th>Ονομασία</th>
              <th>{grouped ? 'Ποσότητα' : 'Κωδικός'}</th>
              <th>Barcode</th>
              <th>Εταιρεία</th>
              <th>Τμήμα</th>
              <th>Υπόλοιπο χρήσεων</th>
              <th>Κατάσταση</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {grouped
              ? groups.map(g => {
                  const t = g[0];
                  return (
                    <tr key={`${t.code}-${t.name}`}>
                      <td>
                        <b>{t.name}</b>
                      </td>
                      <td>
                        <span className="qty-badge">{g.length}</span>
                      </td>
                      <td className="muted">πολλαπλά</td>
                      <td>{t.manufacturer || '—'}</td>
                      <td>{new Set(g.map(x => x.department)).size === 1 ? t.department : 'Πολλά τμήματα'}</td>
                      <td>—</td>
                      <td className="muted">Μικτή</td>
                      <td>
                        <Link className="icon-link" to={`/tools/${t.id}`}>
                          <ChevronRight size={17} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              : filtered.map(t => (
                  <tr key={t.id}>
                    <td>
                      <div className="registry-asset-name">
                        <AssetTypeIcon kind="TOOL" maxUses={t.maxUses} framed size={15} />
                        <span>
                          <Link className="row-title-link" to={`/tools/${t.id}`}>
                            {t.name}
                          </Link>
                        </span>
                      </div>
                    </td>
                    <td>{t.code}</td>
                    <td className="mono">{t.barcode}</td>
                    <td>{t.manufacturer || '—'}</td>
                    <td>{t.department || '—'}</td>
                    <td>
                      {t.maxUses ? (
                        <>
                          <b>{Math.max(0, t.maxUses - t.uses)}</b>
                          <span className="muted"> / {t.maxUses}</span>
                        </>
                      ) : (
                        <span className="muted">Χωρίς όριο</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge value={t.state} />
                    </td>
                    <td>
                      <Link className="icon-link" to={`/tools/${t.id}`}>
                        <ChevronRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </ScrollableListPanel>
    </div>
  );
}
