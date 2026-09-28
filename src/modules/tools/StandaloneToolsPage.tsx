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
import {tr, trData} from '../../i18n';

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
        eyebrow={tr('ΜΗΤΡΩΟ ΕΞΟΠΛΙΣΜΟΥ')}
        title={tr('Μεμονωμένα εργαλεία σε χρήση')}
        description={tr(
          'Μόνο φυσικά εργαλεία που χρησιμοποιούνται αυτόνομα σε τμήματα και δεν ανήκουν αυτή τη στιγμή σε Σετ.',
        )}
        actions={
          can('asset.create') ? (
            <AppButton variant="primary" icon={<Plus size={17} />} onClick={() => navigate('/tools/new')}>
              {tr('Νέο Εργαλείο')}
            </AppButton>
          ) : undefined
        }
      />
      <KpiStrip
        compact
        items={[
          {label: tr('Σε χρήση'), value: standalone.length},
          {label: tr('Τμήματα'), value: new Set(standalone.map(t => t.department).filter(Boolean)).size},
          {label: tr('Περιορισμένων χρήσεων'), value: standalone.filter(t => t.maxUses).length},
          {
            label: tr('≤ 3 χρήσεις'),
            value: standalone.filter(t => t.maxUses !== undefined && t.maxUses - t.uses <= 3).length,
          },
        ]}
      />
      <div className="asset-list-controls">
        <AssetFilterBar
          query={q}
          onQueryChange={setQ}
          placeholder={tr('Ονομασία, κωδικός ή barcode...')}
          filters={[
            {
              key: 'department',
              value: department,
              placeholder: tr('Όλα τα τμήματα'),
              options: values('department').map(value => ({value, label: value})),
              onChange: setDepartment,
            },
            {
              key: 'specialty',
              value: specialty,
              placeholder: tr('Όλες οι ειδικότητες'),
              options: values('specialty').map(value => ({value, label: value})),
              onChange: setSpecialty,
            },
            {
              key: 'manufacturer',
              value: manufacturer,
              placeholder: tr('Όλες οι εταιρείες'),
              options: values('manufacturer').map(value => ({value, label: value})),
              onChange: setManufacturer,
            },
            {
              key: 'state',
              value: state,
              placeholder: tr('Όλες οι καταστάσεις'),
              options: values('state').map(value => ({value, label: value})),
              onChange: setState,
            },
          ]}
        />
        <IconToggleButton
          active={grouped}
          activeIcon={<List size={17} />}
          inactiveIcon={<Layers3 size={17} />}
          activeTitle={tr('Εμφάνιση φυσικών εγγραφών')}
          inactiveTitle={tr('Ομαδοποίηση ίδιων εργαλείων')}
          onClick={() => setGrouped(v => !v)}
        />
      </div>
      <ScrollableListPanel withKpis ariaLabel={tr('Μεμονωμένα εργαλεία σε χρήση')}>
        <table className="asset-registry-table">
          <thead>
            <tr>
              <th>{tr('Ονομασία')}</th>
              <th>{grouped ? tr('Ποσότητα') : tr('Κωδικός')}</th>
              <th>Barcode</th>
              <th>{tr('Εταιρεία')}</th>
              <th>{tr('Τμήμα')}</th>
              <th>{tr('Υπόλοιπο χρήσεων')}</th>
              <th>{tr('Κατάσταση')}</th>
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
                      <td className="muted">{tr('πολλαπλά')}</td>
                      <td>{t.manufacturer || '—'}</td>
                      <td>{new Set(g.map(x => x.department)).size === 1 ? t.department : tr('Πολλά τμήματα')}</td>
                      <td>—</td>
                      <td className="muted">{tr('Μικτή')}</td>
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
                    <td className="cell-nowrap">{t.code}</td>
                    <td className="mono cell-nowrap">{t.barcode}</td>
                    <td>{t.manufacturer || '—'}</td>
                    <td>{trData(t.department) || '—'}</td>
                    <td>
                      {t.maxUses ? (
                        <>
                          <b>{Math.max(0, t.maxUses - t.uses)}</b>
                          <span className="muted"> / {t.maxUses}</span>
                        </>
                      ) : (
                        <span className="muted">{tr('Χωρίς όριο')}</span>
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
