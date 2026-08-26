import {useMemo, useState} from 'react';
import {Link, useNavigate} from 'react-router-dom';
import {Layers3, Plus, ChevronRight, List} from 'lucide-react';
import {useSurgi} from '../../store/SurgiStore';
import StatusBadge from '../../components/ui/StatusBadge';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import AppButton from '../../components/ui/AppButton';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import PageHeader from '../../components/ui/PageHeader';
import IconToggleButton from '../../components/ui/IconToggleButton';
import KpiStrip from '../../components/ui/KpiStrip';

export default function ToolsPage() {
  const {tools, sets, can} = useSurgi();
  const navigate = useNavigate();
  const [grouped, setGrouped] = useState(false);
  const [q, setQ] = useState('');
  const [department, setDepartment] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [state, setState] = useState('');
  const [mode, setMode] = useState('');
  const filtered = tools.filter(
    t =>
      (!department || t.department === department) &&
      (!specialty || t.specialty === specialty) &&
      (!manufacturer || t.manufacturer === manufacturer) &&
      (!state || t.state === state) &&
      (!mode || t.mode === mode) &&
      `${t.barcode} ${t.name} ${t.code} ${t.serialNumber || ''} ${t.manufacturer} ${t.specialty} ${t.department || ''}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const values = (key: 'department' | 'specialty' | 'manufacturer' | 'state' | 'mode') =>
    [...new Set(tools.map(t => String(t[key] || '')).filter(Boolean))].sort();
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
        eyebrow="ASSET MANAGEMENT"
        title="Εργαλεία"
        description="Γενικό μητρώο όλων των φυσικών εργαλείων, ανεξάρτητα αν βρίσκονται σε Stock, σε Σετ ή χρησιμοποιούνται μεμονωμένα."
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
          {label: 'Σύνολο εργαλείων', value: tools.length},
          {label: 'Σε Σετ', value: tools.filter(t => t.mode === 'SET_MEMBER').length},
          {label: 'Μεμονωμένα σε χρήση', value: tools.filter(t => t.mode === 'STANDALONE').length},
          {label: 'Stock', value: tools.filter(t => t.mode === 'STOCK').length},
        ]}
      />
      <div className="asset-list-controls">
        <AssetFilterBar
          query={q}
          onQueryChange={setQ}
          placeholder="Ονομασία, κωδικός, barcode, serial..."
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
              key: 'mode',
              value: mode,
              placeholder: 'Όλες οι θέσεις',
              options: [
                {value: 'STOCK', label: 'Stock'},
                {value: 'SET_MEMBER', label: 'Σετ εργαλείων'},
                {value: 'STANDALONE', label: 'Μεμονωμένα σε χρήση'},
              ],
              onChange: setMode,
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
          onClick={() => setGrouped(x => !x)}
        />
      </div>
      <ScrollableListPanel withKpis ariaLabel="Λίστα εργαλείων">
        <table className="asset-registry-table">
          <thead>
            <tr>
              <th>Ονομασία</th>
              <th>{grouped ? 'Ποσότητα' : 'Κωδικός'}</th>
              <th>Barcode</th>
              <th>Εταιρεία</th>
              <th>Ειδικότητα</th>
              <th>Θέση</th>
              <th>Χρήσεις</th>
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
                      <td>{t.specialty || '—'}</td>
                      <td className="muted">
                        {new Set(g.map(x => x.mode)).size === 1
                          ? t.mode === 'STOCK'
                            ? 'Stock'
                            : t.mode === 'SET_MEMBER'
                              ? 'Σετ'
                              : 'Μεμονωμένα'
                          : 'Μικτή'}
                      </td>
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
              : filtered.map(t => {
                  const set = sets.find(s => s.id === t.setId);
                  return (
                    <tr key={t.id}>
                      <td>
                        <div className="registry-asset-name">
                          <AssetTypeIcon kind="TOOL" maxUses={t.maxUses} framed size={15} />
                          <span>
                            <Link className="row-title-link" to={`/tools/${t.id}`}>
                              {t.name}
                            </Link>
                            {t.serialNumber && <small className="row-sub">S/N {t.serialNumber}</small>}
                          </span>
                        </div>
                      </td>
                      <td>{t.code}</td>
                      <td>
                        <Link className="mono strong-link" to={`/tools/${t.id}`}>
                          {t.barcode}
                        </Link>
                      </td>
                      <td>{t.manufacturer || '—'}</td>
                      <td>{t.specialty || '—'}</td>
                      <td>
                        {t.mode === 'SET_MEMBER' && set ? (
                          <>
                            <b>Σετ</b>
                            <small className="row-sub">
                              {set.barcode} · {set.name}
                            </small>
                          </>
                        ) : t.mode === 'STOCK' ? (
                          <b>Stock</b>
                        ) : (
                          <>
                            <b>Μεμονωμένο</b>
                            <small className="row-sub">{t.department || '—'}</small>
                          </>
                        )}
                      </td>
                      <td>
                        {t.maxUses ? (
                          <>
                            <b>{Math.max(0, t.maxUses - t.uses)}</b>
                            <span className="muted"> υπόλοιπο / {t.maxUses}</span>
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
                  );
                })}
          </tbody>
        </table>
      </ScrollableListPanel>
    </div>
  );
}
