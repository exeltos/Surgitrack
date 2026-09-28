import {useState} from 'react';
import {ArrowRightLeft, FileUp, Plus, ChevronRight} from 'lucide-react';
import {Link, useNavigate} from 'react-router-dom';
import {useSurgi} from '../../store/SurgiStore';
import AssetTypeIcon from '../../components/assets/AssetTypeIcon';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import AppButton from '../../components/ui/AppButton';
import StatusBadge from '../../components/ui/StatusBadge';
import ScrollableListPanel from '../../components/ui/ScrollableListPanel';
import PageHeader from '../../components/ui/PageHeader';
import KpiStrip from '../../components/ui/KpiStrip';
import {tr, trData} from '../../i18n';
import {useRememberedState} from '../../core/listMemory';
import {useSetColorQuestion} from '../../components/assets/useSetColorQuestion';
import ColorMarker from '../../components/assets/ColorMarker';
import {effectiveToolMarker} from '../../core/colorTapes';

export default function StockPage() {
  const {tools, sets, moveTool, applyColorPlan, can} = useSurgi();
  const colorQuestion = useSetColorQuestion();
  // A stock instrument with its own color joining a Set: ask whether it keeps it.
  const addToSet = async (toolId: string, setId: string) => {
    const plan = await colorQuestion.ask([toolId], setId);
    if (!plan) return;
    moveTool(toolId, 'SET', setId);
    applyColorPlan(plan, sets.find(s => s.id === setId)?.barcode || '');
  };
  const canCompose = can('asset.composition.manage');
  const navigate = useNavigate();
  const stock = tools.filter(t => t.mode === 'STOCK');
  const [target, setTarget] = useState<Record<string, string>>({});
  const [q, setQ] = useRememberedState('q', '');
  const [specialty, setSpecialty] = useRememberedState('specialty', '');
  const [manufacturer, setManufacturer] = useRememberedState('manufacturer', '');
  const [state, setState] = useRememberedState('state', '');
  const values = (key: 'specialty' | 'manufacturer' | 'state') =>
    [...new Set(stock.map(t => String(t[key] || '')).filter(Boolean))].sort();
  const filtered = stock.filter(
    t =>
      (!specialty || t.specialty === specialty) &&
      (!manufacturer || t.manufacturer === manufacturer) &&
      (!state || t.state === state) &&
      `${t.name} ${t.code} ${t.barcode} ${t.serialNumber || ''} ${t.manufacturer} ${t.specialty}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <div className="tools-list-workspace">
      <PageHeader
        eyebrow={tr('ΜΗΤΡΩΟ ΕΞΟΠΛΙΣΜΟΥ')}
        title={tr('Stock εργαλείων')}
        description={tr('Διαθέσιμα φυσικά εργαλεία για αντικατάσταση, σύνθεση Σετ ή αυτόνομη διάθεση.')}
        actions={
          <div className="actions asset-page-actions">
            <AppButton icon={<FileUp size={16} />}>{tr('Μαζικό upload')}</AppButton>
            {can('asset.create') && (
              <AppButton variant="primary" icon={<Plus size={16} />} onClick={() => navigate('/tools/new')}>
                {tr('Νέο Εργαλείο')}
              </AppButton>
            )}
          </div>
        }
      />
      <KpiStrip
        items={[
          {label: tr('Διαθέσιμα'), value: stock.length},
          {label: tr('Με όριο χρήσεων'), value: stock.filter(t => t.maxUses).length},
          {label: tr('Σετ με έλλειψη'), value: sets.filter(s => s.actual < s.expected).length},
        ]}
      />
      <AssetFilterBar
        query={q}
        onQueryChange={setQ}
        placeholder={tr('Ονομασία, κωδικός, barcode ή serial...')}
        filters={[
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
      <ScrollableListPanel withKpis ariaLabel={tr('Stock εργαλείων')}>
        <table className="asset-registry-table">
          <thead>
            <tr>
              <th>Barcode</th>
              <th>{tr('Κωδικός')}</th>
              <th>{tr('Εργαλείο')}</th>
              <th>{tr('Κατασκευαστής')}</th>
              <th>{tr('Ειδικότητα')}</th>
              <th>{tr('Χρήσεις')}</th>
              <th>{tr('Κατάσταση')}</th>
              {canCompose && <th>{tr('Προσθήκη σε Σετ')}</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id}>
                <td className="mono cell-nowrap">{t.barcode}</td>
                <td className="cell-nowrap">{t.code}</td>
                <td>
                  <div className="registry-asset-name">
                    <AssetTypeIcon kind="TOOL" maxUses={t.maxUses} framed size={15} />
                    <span>
                      <strong>{t.name}</strong>
                      <ColorMarker tapes={effectiveToolMarker(t)} size="sm" />
                    </span>
                  </div>
                </td>
                <td>{t.manufacturer}</td>
                <td>{trData(t.specialty) || '—'}</td>
                <td>{t.maxUses ? `${t.uses}/${t.maxUses}` : '—'}</td>
                <td>
                  <StatusBadge value={t.state} />
                </td>
                {canCompose && (
                  <td>
                    <div className="inline-action">
                      <select
                        value={target[t.id] || ''}
                        onChange={e => setTarget(x => ({...x, [t.id]: e.target.value}))}
                      >
                        <option value="">{tr('Επιλογή Σετ...')}</option>
                        {sets.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.barcode} · {s.name}
                          </option>
                        ))}
                      </select>
                      <AppButton
                        size="sm"
                        disabled={!target[t.id]}
                        icon={<ArrowRightLeft size={15} />}
                        onClick={() => void addToSet(t.id, target[t.id])}
                      >
                        {tr('Προσθήκη')}
                      </AppButton>
                    </div>
                  </td>
                )}
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
      {colorQuestion.dialog}
    </div>
  );
}
