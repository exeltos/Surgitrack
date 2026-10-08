import {useMemo, useState} from 'react';
import {
  ChevronRight,
  Clock3,
  Eraser,
  FileSpreadsheet,
  MapPin,
  Printer,
  Route,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import {supabase} from '../../lib/supabase';
import {actingAsPlatformOwner} from '../../data/cloud/identity';
import {managedHospitalId} from '../../data/cloud/accessRequests';
import {useSurgi} from '../../store/SurgiStore';
import type {Movement} from '../../types/domain';
import {getI18nLang, tr, trData} from '../../i18n';
import {MoreRows} from '../../components/ui/ProgressiveList';
import {useProgressiveList} from '../../core/useProgressiveList';
import {useRememberedState} from '../../core/listMemory';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import {downloadXlsx, tableReportHtml, type ExportTable} from '../../core/exportTable';

function dateKey(value: string) {
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : '';
}
function assetParts(value: string) {
  const [barcode, ...rest] = value.split(' · ');
  return {barcode, name: rest.join(' · ') || value};
}

export default function MovementsPage() {
  const {movements, sets, tools, role, currentUser, forgetMovements} = useSurgi();
  // Only the platform owner, working in a real hospital, can clean chosen entries out of the history.
  const ownerHospital = actingAsPlatformOwner() ? managedHospitalId() : undefined;
  const [cleaning, setCleaning] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [cleanError, setCleanError] = useState('');
  const departmentBarcodes = useMemo(
    () =>
      new Set([
        ...sets.filter(item => item.department === currentUser.department).map(item => item.barcode),
        ...tools.filter(item => item.department === currentUser.department).map(item => item.barcode),
      ]),
    [sets, tools, currentUser.department],
  );
  const scopedMovements = useMemo(
    () =>
      role === 'DEPARTMENT'
        ? movements.filter(movement => {
            const barcode = assetParts(movement.asset).barcode;
            return (
              departmentBarcodes.has(barcode) ||
              movement.from === currentUser.department ||
              movement.to === currentUser.department
            );
          })
        : movements,
    [movements, role, currentUser.department, departmentBarcodes],
  );
  const [q, setQ] = useRememberedState('q', '');
  const [from, setFrom] = useRememberedState('from', '');
  const [to, setTo] = useRememberedState('to', '');
  const [status, setStatus] = useRememberedState('status', '');
  const [kind, setKind] = useRememberedState('kind', '');
  const [dateFrom, setDateFrom] = useRememberedState('dateFrom', '');
  const [dateTo, setDateTo] = useRememberedState('dateTo', '');
  const [report, setReport] = useState<string | null>(null);
  const [selected, setSelected] = useState<Movement | null>(null);
  const values = (key: 'from' | 'to' | 'status') =>
    [...new Set(scopedMovements.map(m => m[key]).filter(Boolean))].sort();
  const filtered = useMemo(
    () =>
      scopedMovements.filter(m => {
        const d = dateKey(m.at);
        const hay = `${m.asset} ${m.from} ${m.to} ${m.status} ${m.by} ${m.patientCode || ''}`.toLowerCase();
        return (
          (!from || m.from === from) &&
          (!to || m.to === to) &&
          (!status || m.status === status) &&
          (!kind || m.assetKind === kind) &&
          (!dateFrom || !d || d >= dateFrom) &&
          (!dateTo || !d || d <= dateTo) &&
          hay.includes(q.toLowerCase())
        );
      }),
    [scopedMovements, q, from, to, status, kind, dateFrom, dateTo],
  );
  const valuesOf = (key: 'from' | 'to' | 'status') => values(key).map(v => ({value: v, label: v}));
  // What the export contains: the filtered list, with the filters in use written under the title.
  const exportTable = (): ExportTable => {
    const used = [
      q && `${tr('Αναζήτηση')}: ${q}`,
      kind && (kind === 'SET' ? tr('Σετ') : tr('Εργαλεία')),
      from && `${tr('Από')}: ${trData(from)}`,
      to && `${tr('Προς')}: ${trData(to)}`,
      status && trData(status),
      dateFrom && `${tr('Από')} ${dateFrom}`,
      dateTo && `${tr('Έως')} ${dateTo}`,
    ].filter(Boolean);
    return {
      title: tr('Ιστορικό κινήσεων'),
      subtitle: `${filtered.length} ${filtered.length === 1 ? tr('εγγραφή') : tr('εγγραφές')}${
        used.length ? ` · ${used.join(' · ')}` : ''
      }`,
      headers: [
        'Ημερομηνία / ώρα',
        'Barcode',
        'Σετ / Εργαλείο',
        'Τύπος',
        'Από',
        'Προς',
        'Ενέργεια',
        'Χρήστης',
        'Κωδικός ασθενούς',
      ].map(h => tr(h)),
      rows: filtered.map(m => {
        const asset = assetParts(m.asset);
        return [
          m.at,
          asset.barcode,
          asset.name !== asset.barcode ? asset.name : '',
          m.assetKind === 'SET' ? tr('Σετ') : tr('Εργαλείο'),
          trData(m.from),
          trData(m.to),
          trData(m.status),
          trData(m.by),
          m.patientCode || '',
        ];
      }),
    };
  };
  const rows = useProgressiveList(filtered, [q, from, to, status, kind, dateFrom, dateTo].join('|'));
  const togglePick = (id: string) =>
    setPicked(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const stopCleaning = () => {
    setCleaning(false);
    setPicked(new Set());
    setCleanError('');
  };
  const deletePicked = async () => {
    if (!ownerHospital || !picked.size) return;
    if (
      !window.confirm(
        tr('Οριστική διαγραφή {0} εγγραφών από το ιστορικό; Ο καθαρισμός θα καταγραφεί ως νέα εγγραφή.', picked.size),
      )
    )
      return;
    setBusy(true);
    setCleanError('');
    const ids = [...picked];
    const {error} = await supabase.rpc('platform_delete_movements', {p_org: ownerHospital, p_ids: ids});
    setBusy(false);
    if (error) {
      setCleanError(tr('Η διαγραφή δεν ολοκληρώθηκε: {0}', error.message));
      return;
    }
    forgetMovements(ids);
    stopCleaning();
  };
  return (
    <div className="movements-workspace">
      <div className="page-head movements-head">
        <div>
          <h1>{tr('Ιστορικό κινήσεων')}</h1>
          <p>
            {role === 'DEPARTMENT'
              ? tr('Ιστορικό ιχνηλασιμότητας του τμήματος {0}.', trData(currentUser.department))
              : tr('Αμετάβλητο ιστορικό παραδόσεων, παραλαβών, ελέγχων και μετακινήσεων.')}
          </p>
        </div>
        <div className="movements-actions">
          {ownerHospital && !cleaning && (
            <button onClick={() => setCleaning(true)} title={tr('Μόνο για τον owner της πλατφόρμας')}>
              <Eraser size={16} /> {tr('Καθαρισμός ιστορικού')}
            </button>
          )}
          <button onClick={() => downloadXlsx(exportTable())}>
            <FileSpreadsheet size={16} /> {tr('Εξαγωγή Excel')}
          </button>
          <button onClick={() => setReport(tableReportHtml(exportTable(), getI18nLang()))}>
            <Printer size={16} /> {tr('Εκτύπωση / PDF')}
          </button>
        </div>
      </div>
      <AssetFilterBar
        className="movement-filter-bar"
        query={q}
        onQueryChange={setQ}
        placeholder={tr('Barcode, Set/εργαλείο, χρήστης ή κωδικός ασθενούς...')}
        filters={[
          {
            key: 'kind',
            value: kind,
            placeholder: tr('Σετ & εργαλεία'),
            options: [
              {value: 'SET', label: tr('Σετ')},
              {value: 'TOOL', label: tr('Εργαλεία')},
            ],
            onChange: setKind,
          },
          {
            key: 'from',
            value: from,
            placeholder: tr('Από όλα τα τμήματα'),
            options: valuesOf('from'),
            onChange: setFrom,
          },
          {key: 'to', value: to, placeholder: tr('Προς όλα τα τμήματα'), options: valuesOf('to'), onChange: setTo},
          {
            key: 'status',
            value: status,
            placeholder: tr('Όλες οι κινήσεις'),
            options: valuesOf('status'),
            onChange: setStatus,
          },
          {
            key: 'dateFrom',
            type: 'date',
            value: dateFrom,
            placeholder: tr('Από ημερομηνία'),
            options: [],
            onChange: setDateFrom,
          },
          {
            key: 'dateTo',
            type: 'date',
            value: dateTo,
            placeholder: tr('Έως ημερομηνία'),
            options: [],
            onChange: setDateTo,
          },
        ]}
      />
      {cleaning && (
        <div className="movement-clean-bar" role="region" aria-label={tr('Καθαρισμός ιστορικού')}>
          <Eraser size={18} />
          <span>
            <strong>{tr('Καθαρισμός ιστορικού')}</strong>
            <small>{tr('Επιλέξτε τις εγγραφές που θα διαγραφούν οριστικά · {0} επιλεγμένες', picked.size)}</small>
          </span>
          <button type="button" onClick={() => setPicked(new Set(filtered.map(m => m.id)))}>
            {tr('Επιλογή όλων των εμφανιζόμενων ({0})', filtered.length)}
          </button>
          {picked.size > 0 && (
            <button type="button" onClick={() => setPicked(new Set())}>
              {tr('Αποεπιλογή')}
            </button>
          )}
          <button type="button" onClick={stopCleaning}>
            {tr('Ακύρωση')}
          </button>
          <button type="button" className="danger" disabled={!picked.size || busy} onClick={deletePicked}>
            <Trash2 size={15} /> {tr('Διαγραφή επιλεγμένων')}
          </button>
          {cleanError && <p className="movement-clean-error">{cleanError}</p>}
        </div>
      )}
      <div className={`movement-ledger ${cleaning ? 'cleaning' : ''}`}>
        <div className="ledger-head">
          <div>
            <span>
              {filtered.length} {filtered.length === 1 ? tr('εγγραφή') : tr('εγγραφές')}
            </span>
          </div>
          <small>
            <ShieldCheck size={14} /> {tr('Audit trail · οι εγγραφές δεν τροποποιούνται')}
          </small>
        </div>
        <div className="ledger-columns">
          <span>{tr('Ημερομηνία / ώρα')}</span>
          <span>{tr('Set / Εργαλείο')}</span>
          <span>{tr('Διαδρομή')}</span>
          <span>{tr('Ενέργεια')}</span>
          <span>{tr('Χρήστης')}</span>
          <span></span>
        </div>
        <div className="ledger-scroll">
          {filtered.length ? (
            rows.visible.map(m => {
              const asset = assetParts(m.asset);
              return (
                <button
                  className={`ledger-row ${picked.has(m.id) ? 'picked' : ''}`}
                  key={m.id}
                  onClick={() => (cleaning ? togglePick(m.id) : setSelected(m))}
                  aria-pressed={cleaning ? picked.has(m.id) : undefined}
                >
                  <span className="ledger-date">
                    {cleaning ? (
                      <input type="checkbox" checked={picked.has(m.id)} readOnly tabIndex={-1} aria-hidden="true" />
                    ) : (
                      <Clock3 size={15} />
                    )}
                    <b>{m.at}</b>
                  </span>
                  <span className="ledger-asset">
                    <small>{m.assetKind === 'SET' ? 'SET' : tr('ΕΡΓΑΛΕΙΟ')}</small>
                    <b>{asset.barcode}</b>
                    {asset.name !== asset.barcode && <em>{asset.name}</em>}
                  </span>
                  <span className="ledger-route">
                    <i>{trData(m.from)}</i>
                    <ChevronRight size={15} />
                    <i>{trData(m.to)}</i>
                  </span>
                  <span>
                    <mark className="movement-chip" title={trData(m.status)}>
                      {trData(m.status)}
                    </mark>
                  </span>
                  <span className="ledger-user">
                    <UserRound size={15} />
                    <span>
                      <b>{trData(m.by)}</b>
                      {m.patientCode && <small>{tr('Ασθενής {0}', m.patientCode)}</small>}
                    </span>
                  </span>
                  <ChevronRight className="ledger-open" size={18} />
                </button>
              );
            })
          ) : (
            <div className="ledger-empty">
              <Route size={28} />
              <strong>{tr('Δεν βρέθηκαν κινήσεις')}</strong>
              <span>{tr('Αλλάξτε ή καθαρίστε τα φίλτρα αναζήτησης.')}</span>
            </div>
          )}
          {rows.hasMore && <MoreRows onVisible={rows.showMore} />}
        </div>
      </div>
      {selected && (
        <div
          className="movement-modal-backdrop"
          onMouseDown={e => {
            if (e.currentTarget === e.target) setSelected(null);
          }}
        >
          <div className="movement-detail" role="dialog" aria-modal="true">
            <div className="movement-detail-head">
              <div>
                <small>CHAIN OF CUSTODY</small>
                <h2>{tr('Λεπτομέρειες κίνησης')}</h2>
                <span>{selected.asset}</span>
              </div>
              <button onClick={() => setSelected(null)} aria-label={tr('Κλείσιμο')}>
                <X />
              </button>
            </div>
            <div className="movement-detail-grid">
              <div>
                <Clock3 />
                <span>{tr('Ημερομηνία & ώρα')}</span>
                <strong>{selected.at}</strong>
              </div>
              <div>
                <Route />
                <span>{tr('Ενέργεια')}</span>
                <strong>{trData(selected.status)}</strong>
              </div>
              <div>
                <MapPin />
                <span>{tr('Από')}</span>
                <strong>{trData(selected.from)}</strong>
              </div>
              <div>
                <MapPin />
                <span>{tr('Προς')}</span>
                <strong>{trData(selected.to)}</strong>
              </div>
              <div>
                <UserRound />
                <span>{tr('Καταχώρηση από')}</span>
                <strong>{trData(selected.by)}</strong>
              </div>
              <div>
                <ShieldCheck />
                <span>{tr('Τύπος αντικειμένου')}</span>
                <strong>{selected.assetKind === 'SET' ? tr('Σετ') : tr('Εργαλείο')}</strong>
              </div>
              {selected.patientCode && (
                <div className="movement-patient">
                  <span>{tr('Κωδικός ασθενούς')}</span>
                  <strong>{selected.patientCode}</strong>
                </div>
              )}
            </div>
            <div className="movement-detail-foot">
              <ShieldCheck size={17} />
              <span>{tr('Η εγγραφή αποτελεί μέρος του audit trail και είναι μόνο για ανάγνωση.')}</span>
            </div>
          </div>
        </div>
      )}
      {report && <PrintPreviewModal title={tr('Ιστορικό κινήσεων')} html={report} onClose={() => setReport(null)} />}
    </div>
  );
}
