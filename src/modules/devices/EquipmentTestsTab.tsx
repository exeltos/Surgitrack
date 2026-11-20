import {useMemo, useState} from 'react';
import {Printer} from 'lucide-react';
import {TEST_KINDS} from '../../core/equipmentTests';
import type {EquipmentTestKind, LibraryItem} from '../../core/libraries';
import {parseDisplayDate} from '../../core/displayDate';
import {escapeHtml as esc} from '../../core/escapeHtml';
import {useAppPreferences} from '../../core/AppPreferences';
import AppButton from '../../components/ui/AppButton';
import PrintPreviewModal from '../../components/assets/PrintPreviewModal';
import {now, page} from '../replacements/replacementPrint';
import {tr, trData} from '../../i18n';

type Row = {
  id: string;
  equipment: string;
  kind: EquipmentTestKind;
  result: 'PASS' | 'FAIL';
  at: string;
  stamp: number;
  by: string;
  note?: string;
};

/**
 * Every test of the sterilizers and washers in one list, the newest first: which machine, which test, the result,
 * when and by whom. Filtered by machine, test and result, and printed for an inspection as it is filtered.
 */
export default function EquipmentTestsTab({
  sterilizers,
  washers,
  hospital,
}: {
  sterilizers: readonly LibraryItem[];
  washers: readonly LibraryItem[];
  hospital?: string;
}) {
  const {lang} = useAppPreferences();
  const label = (kind: EquipmentTestKind) => {
    const k = TEST_KINDS.find(x => x.id === kind);
    return k ? (lang === 'el' ? k.el : k.en) : kind;
  };
  const rows = useMemo<Row[]>(
    () =>
      [...sterilizers, ...washers]
        .flatMap(item =>
          (item.tests || []).map(test => ({
            id: `${item.id}-${test.id}`,
            equipment: item.el,
            kind: test.kind,
            result: test.result,
            at: test.at,
            stamp: parseDisplayDate(test.at)?.getTime() ?? 0,
            by: test.by,
            note: test.note,
          })),
        )
        .sort((a, b) => b.stamp - a.stamp),
    [sterilizers, washers],
  );
  const [equipment, setEquipment] = useState('');
  const [kind, setKind] = useState('');
  const [result, setResult] = useState('');
  const [preview, setPreview] = useState<{title: string; html: string} | null>(null);
  const shown = rows.filter(
    r => (!equipment || r.equipment === equipment) && (!kind || r.kind === kind) && (!result || r.result === result),
  );
  const machines = [...new Set(rows.map(r => r.equipment))];
  const kinds = TEST_KINDS.filter(k => rows.some(r => r.kind === k.id));

  const print = () => {
    const subtitle = [
      equipment ? trData(equipment) : tr('Όλα τα μηχανήματα'),
      kind ? label(kind as EquipmentTestKind) : '',
      result ? (result === 'PASS' ? tr('Επιτυχία') : tr('Αποτυχία')) : '',
    ]
      .filter(Boolean)
      .join(' · ');
    const body = shown
      .map(
        (r, i) =>
          `<tr><td class="num">${i + 1}</td><td>${esc(r.at)}</td><td class="name">${esc(trData(r.equipment))}</td><td>${esc(label(r.kind))}</td><td>${r.result === 'PASS' ? `<span class="yes">${esc(tr('Επιτυχία'))}</span>` : `<span class="no">${esc(tr('Αποτυχία'))}</span>`}</td><td>${esc(r.by)}</td><td>${esc(r.note || '')}</td></tr>`,
      )
      .join('');
    setPreview({
      title: tr('Δοκιμές εξοπλισμού'),
      html: page(
        tr('Δοκιμές εξοπλισμού'),
        `<div class="top"><div><div class="brand">SurgiTrack${hospital ? ` · ${esc(hospital)}` : ''}</div><div class="doc">${esc(tr('Ιστορικό δοκιμών κλιβάνων και πλυντηρίων'))}</div><h1>${esc(tr('Δοκιμές εξοπλισμού'))}</h1><p>${esc(subtitle)}</p></div><div class="when">${esc(now())}</div></div>
<div class="sum"><div><b>${esc(tr('Σύνολο'))}</b><span>${shown.length}</span></div><div><b>${esc(tr('Αποτυχίες'))}</b><span>${shown.filter(r => r.result === 'FAIL').length}</span></div></div>
<table><thead><tr><th class="num">#</th><th>${esc(tr('Ημερομηνία'))}</th><th>${esc(tr('Μηχάνημα'))}</th><th>${esc(tr('Δοκιμή'))}</th><th>${esc(tr('Αποτέλεσμα'))}</th><th>${esc(tr('Από'))}</th><th>${esc(tr('Σημείωση'))}</th></tr></thead>
<tbody>${body || `<tr><td colspan="7">${esc(tr('Δεν υπάρχουν εγγραφές για τα επιλεγμένα φίλτρα.'))}</td></tr>`}</tbody></table>
<div class="footer"><span>SurgiTrack</span><span>${esc(tr('{0} εγγραφές', shown.length))}</span></div>`,
      ),
    });
  };

  return (
    <section className="equipment-tests-tab" aria-label={tr('Δοκιμές εξοπλισμού')}>
      <div className="equipment-tests-bar">
        <select value={equipment} onChange={e => setEquipment(e.target.value)} aria-label={tr('Μηχάνημα')}>
          <option value="">{tr('Όλα τα μηχανήματα')}</option>
          {machines.map(m => (
            <option key={m} value={m}>
              {trData(m)}
            </option>
          ))}
        </select>
        <select value={kind} onChange={e => setKind(e.target.value)} aria-label={tr('Δοκιμή')}>
          <option value="">{tr('Όλες οι δοκιμές')}</option>
          {kinds.map(k => (
            <option key={k.id} value={k.id}>
              {lang === 'el' ? k.el : k.en}
            </option>
          ))}
        </select>
        <select value={result} onChange={e => setResult(e.target.value)} aria-label={tr('Αποτέλεσμα')}>
          <option value="">{tr('Όλα τα αποτελέσματα')}</option>
          <option value="PASS">{tr('Επιτυχία')}</option>
          <option value="FAIL">{tr('Αποτυχία')}</option>
        </select>
        <span className="equipment-tests-count">{tr('{0} εγγραφές', shown.length)}</span>
        <AppButton size="sm" icon={<Printer size={15} />} onClick={print} disabled={!shown.length}>
          {tr('Εκτύπωση')}
        </AppButton>
      </div>
      <div className="equipment-tests-scroll">
        {shown.length ? (
          <table className="equipment-tests-table">
            <thead>
              <tr>
                <th scope="col">{tr('Ημερομηνία')}</th>
                <th scope="col">{tr('Μηχάνημα')}</th>
                <th scope="col">{tr('Δοκιμή')}</th>
                <th scope="col">{tr('Αποτέλεσμα')}</th>
                <th scope="col">{tr('Από')}</th>
                <th scope="col">{tr('Σημείωση')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={r.id}>
                  <td>{r.at}</td>
                  <td>{trData(r.equipment)}</td>
                  <td>{label(r.kind)}</td>
                  <td>
                    <span className={`test-result ${r.result === 'PASS' ? 'ok' : 'bad'}`}>
                      {r.result === 'PASS' ? tr('Επιτυχία') : tr('Αποτυχία')}
                    </span>
                  </td>
                  <td>{r.by}</td>
                  <td className="muted">{r.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">{tr('Δεν υπάρχουν εγγραφές για τα επιλεγμένα φίλτρα.')}</p>
        )}
      </div>
      {preview && <PrintPreviewModal title={preview.title} html={preview.html} onClose={() => setPreview(null)} />}
    </section>
  );
}
