import {useState} from 'react';
import {CheckCheck, ClipboardCheck, Printer, ScanBarcode, X} from 'lucide-react';
import AppButton from '../ui/AppButton';
import {useSurgi} from '../../store/SurgiStore';
import type {SurgicalCount} from '../../store/types';
import type {AssetKind} from '../../types/domain';
import {formatExpiry, sterilizedOnOf} from '../../core/sterileExpiry';
import {ExpirySymbol, SterileSymbol} from '../ui/SterileDates';
import {printCountForm} from './printCountForm';
import {tr, trData} from '../../i18n';

/**
 * The operating theatre's instrument count, laid out like the printed count form: part A is what
 * Sterilization signed (composition, release, sterile dates), part B is the count, ticked one by one,
 * scanned or "All present". Signing records it; the Set can then be sent to Sterilization.
 */
export default function CountModal({
  kind,
  id,
  patientCode: initialPatientCode,
  onSigned,
  onClose,
}: {
  kind: AssetKind;
  id: string;
  patientCode?: string;
  onSigned: (count: SurgicalCount) => void;
  onClose: () => void;
}) {
  const {sets, tools, recordCount, preparations, sterilizationReleases, organizationName} = useSurgi();
  const asset = kind === 'SET' ? sets.find(x => x.id === id) : tools.find(x => x.id === id);
  const members = kind === 'SET' ? tools.filter(t => t.setId === id && t.state !== 'RETIRED') : asset ? [asset] : [];
  const preparation = preparations.find(r => r.assetId === id);
  const release = sterilizationReleases.find(r => r.assetId === id && r.decision === 'RELEASED');
  const [patientCode, setPatientCode] = useState(initialPatientCode || '');
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [scan, setScan] = useState('');
  const [scanMessage, setScanMessage] = useState('');
  if (!asset) return null;
  const counted = members.filter(t => ticked.has(t.id)).length;
  const missing = members.filter(t => !ticked.has(t.id));
  const sterilizedOn = asset.sterileUntil ? sterilizedOnOf(asset) : undefined;
  const toggle = (toolId: string) =>
    setTicked(current => {
      const next = new Set(current);
      if (next.has(toolId)) next.delete(toolId);
      else next.add(toolId);
      return next;
    });
  const allPresent = () => {
    if (!window.confirm(tr('Επιβεβαιώνετε ότι καταμετρήθηκαν και τα {0} εργαλεία;', members.length))) return;
    setTicked(new Set(members.map(t => t.id)));
    setBulk(true);
  };
  const scanTool = () => {
    const code = scan.trim().toUpperCase();
    if (!code) return;
    const tool = members.find(t => t.barcode.toUpperCase() === code);
    if (!tool) setScanMessage(tr('Το {0} δεν ανήκει σε αυτό το Σετ.', code));
    else {
      setTicked(current => new Set(current).add(tool.id));
      setScanMessage(tr('{0} · καταμετρήθηκε', `${tool.barcode} ${tool.name}`));
    }
    setScan('');
  };
  const printForm = () =>
    printCountForm({
      asset,
      items: members,
      hospital: organizationName,
      preparation,
      release,
      draft: {checkedToolIds: [...ticked], patientCode: patientCode.trim()},
    });
  const canSign = patientCode.trim().length > 0 && counted > 0;
  const sign = () => {
    if (!canSign) return;
    if (
      missing.length &&
      !window.confirm(tr('Λείπουν {0} εργαλεία. Υπογραφή της καταμέτρησης με έλλειψη;', missing.length))
    )
      return;
    const count = recordCount({
      setId: id,
      assetKind: kind,
      patientCode: patientCode.trim(),
      expected: members.length,
      counted,
      result: missing.length ? 'MISSING' : 'OK',
      note: missing.length ? tr('Λείπουν: {0}', missing.map(t => `${t.barcode} ${t.name}`).join(', ')) : '',
      checkedToolIds: [...ticked],
      missing: missing.map(t => t.barcode),
      mode: bulk ? 'BULK' : 'ITEM',
      sterilizedOn,
      sterilizedTime: asset.sterileUntil ? asset.sterilizedTime : undefined,
      sterileUntil: asset.sterileUntil,
    });
    if (count) onSigned(count);
  };
  const meta: Array<[React.ReactNode, React.ReactNode]> = [
    [tr('Τμήμα'), trData(asset.department) || '—'],
    [
      tr('Σύνθεση'),
      preparation ? (
        <>
          {preparation.preparedByName}
          <small>{preparation.at}</small>
        </>
      ) : (
        '—'
      ),
    ],
    [
      tr('Αποδέσμευση'),
      release ? (
        <>
          {release.releasedByName}
          <small>{release.releasedAt}</small>
        </>
      ) : (
        '—'
      ),
    ],
    [
      <>
        <SterileSymbol /> {tr('Αποστείρωση')}
      </>,
      sterilizedOn ? `${formatExpiry(sterilizedOn)}${asset.sterilizedTime ? `, ${asset.sterilizedTime}` : ''}` : '—',
    ],
    [
      <>
        <ExpirySymbol /> {tr('Λήξη')}
      </>,
      asset.sterileUntil ? formatExpiry(asset.sterileUntil) : '—',
    ],
    [tr('Κύκλος / κλίβανος'), release ? `${release.cycleNumber} · ${trData(release.sterilizer)}` : '—'],
  ];
  return (
    <div className="modal-backdrop count-form-backdrop" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <div className="count-form-modal" role="dialog" aria-label={tr('Καταμέτρηση εργαλείων')}>
        <header>
          <div>
            <span className="eyebrow">{tr('ΕΝΤΥΠΟ ΚΑΤΑΜΕΤΡΗΣΗΣ ΕΡΓΑΛΕΙΩΝ')}</span>
            <h2>{asset.name}</h2>
            <p className="mono">{asset.barcode}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label={tr('Κλείσιμο')}>
            <X size={18} />
          </button>
        </header>
        <div className="count-form-body">
          <section>
            <h3>
              {tr('Α. Αποστείρωση · ελεγμένο και αποστειρωμένο')}
              <small className={release ? 'signed' : 'pending'}>
                {release ? tr('Υπογεγραμμένο ηλεκτρονικά') : tr('Χωρίς αποδέσμευση')}
              </small>
            </h3>
            <div className="count-form-meta">
              {meta.map(([label, value], index) => (
                <div key={index}>
                  <b>{label}</b>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </section>
          <section className="count-form-b">
            <h3>
              {tr('Β. Χειρουργείο · καταμέτρηση μετά την επέμβαση')}
              <small className="pending">{tr('Εκκρεμεί υπογραφή')}</small>
            </h3>
            <div className="count-form-tools">
              <label className="count-form-patient">
                <span>{tr('Κωδικός ασθενούς')}</span>
                <input
                  value={patientCode}
                  onChange={e => setPatientCode(e.target.value)}
                  placeholder={tr('π.χ. PT-2026-00125')}
                />
              </label>
              {kind === 'SET' && (
                <label className="count-form-scan">
                  <span>
                    <ScanBarcode size={14} /> {tr('Σάρωση εργαλείου')}
                  </span>
                  <input
                    value={scan}
                    onChange={e => setScan(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        scanTool();
                      }
                    }}
                    placeholder={tr('Σάρωση barcode εργαλείου + Enter')}
                  />
                </label>
              )}
              {members.length > 1 && (
                <button
                  type="button"
                  className="count-form-all"
                  onClick={allPresent}
                  disabled={counted === members.length}
                >
                  <CheckCheck size={15} /> {tr('Όλα παρόντα')}
                </button>
              )}
            </div>
            {scanMessage && <p className="count-form-scan-message">{scanMessage}</p>}
            <div className="count-form-table">
              <table>
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>Barcode</th>
                    <th>{tr('Εργαλείο')}</th>
                    <th>{tr('Κωδικός')}</th>
                    <th className="chk">{tr('Εστάλη')}</th>
                    <th className="chk">{tr('Καταμετρήθηκε')}</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((t, index) => (
                    <tr key={t.id} className={ticked.has(t.id) ? 'on' : ''} onClick={() => toggle(t.id)}>
                      <td className="num">{index + 1}</td>
                      <td className="mono">{t.barcode}</td>
                      <td className="name">{t.name}</td>
                      <td>{t.code}</td>
                      <td className="chk">
                        <span className="count-form-sent">✓</span>
                      </td>
                      <td className="chk">
                        <input
                          type="checkbox"
                          checked={ticked.has(t.id)}
                          onClick={e => e.stopPropagation()}
                          onChange={() => toggle(t.id)}
                          aria-label={tr('Καταμετρήθηκε')}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className={`count-form-sum ${missing.length && counted ? 'short' : ''}`}>
              {tr('Καταμετρήθηκαν {0} από {1}', counted, members.length)}
              {counted > 0 && missing.length > 0
                ? ` · ${tr('Λείπουν: {0}', missing.map(t => t.barcode).join(', '))}`
                : ''}
            </p>
          </section>
        </div>
        <footer>
          <AppButton icon={<Printer size={16} />} onClick={printForm} className="count-form-print">
            {tr('Έντυπο καταμέτρησης')}
          </AppButton>
          <AppButton onClick={onClose}>{tr('Ακύρωση')}</AppButton>
          <AppButton variant="primary" icon={<ClipboardCheck size={17} />} onClick={sign} disabled={!canSign}>
            {tr('Υπογραφή καταμέτρησης')}
          </AppButton>
        </footer>
      </div>
    </div>
  );
}
