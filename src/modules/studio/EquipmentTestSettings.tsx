import {Printer} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
import {testKindsFor, testKindsOf} from '../../core/equipmentTests';
import type {EquipmentTestKind, LibraryItem, TestedEquipment} from '../../core/libraries';
import {useHasModule} from '../../data/cloud/modulesContext';
import {useSurgi} from '../../store/SurgiStore';
import {getI18nLang, tr, trData} from '../../i18n';
import {printDocumentInWindow} from '../sterilization/printUtils';
import {testLogHtml} from '../sterilization/printTestLog';

/**
 * Settings → Sterilization: the tests each sterilizer and washer is held to (a plasma sterilizer has no Bowie-Dick),
 * and the paper log to print for it, a box per day to stick the indicator strip in.
 */
export default function EquipmentTestSettings() {
  const libs = useLibraries();
  const {organizationName} = useSurgi();
  const on = useHasModule('EQUIPMENT_TESTS');
  if (!on) return null;
  const en = getI18nLang() === 'en';
  const rows: Array<{item: LibraryItem; key: 'sterilizers' | 'washers'; equipment: TestedEquipment}> = [
    ...libs.sterilizers
      .filter(i => i.active !== false)
      .map(item => ({item, key: 'sterilizers' as const, equipment: 'STERILIZER' as const})),
    ...libs.washers
      .filter(i => i.active !== false)
      .map(item => ({item, key: 'washers' as const, equipment: 'WASHER' as const})),
  ];
  if (!rows.length) return null;
  const toggle = (row: (typeof rows)[number], id: EquipmentTestKind) => {
    const current = testKindsOf(row.item, row.equipment);
    const next = current.includes(id) ? current.filter(k => k !== id) : [...current, id];
    libs.updateItem(row.key, row.item.id, {testKinds: next});
  };
  return (
    <section className="equipment-test-settings">
      <header>
        <strong>{tr('Δοκιμές ανά κλίβανο και πλυντήριο')}</strong>
        <small>
          {tr(
            'Ποιες δοκιμές κάνει ο καθένας· μόνο αυτές ζητούνται πριν τη φόρτωση. Το έντυπο έχει θέση για την επικόλληση του δείκτη.',
          )}
        </small>
      </header>
      <ul>
        {rows.map(row => {
          const chosen = testKindsOf(row.item, row.equipment);
          return (
            <li key={`${row.key}:${row.item.id}`}>
              <b>{trData(row.item.el)}</b>
              <div className="equipment-test-kinds">
                {testKindsFor(row.equipment).map(kind => (
                  <label key={kind.id} className={chosen.includes(kind.id) ? 'on' : ''}>
                    <input type="checkbox" checked={chosen.includes(kind.id)} onChange={() => toggle(row, kind.id)} />
                    {en ? kind.en : kind.el}
                  </label>
                ))}
              </div>
              <button
                type="button"
                className="equipment-test-print"
                disabled={!chosen.length}
                onClick={() =>
                  printDocumentInWindow(
                    tr('Δοκιμές · {0}', trData(row.item.el)),
                    testLogHtml(organizationName || '', row.item.el, chosen),
                  )
                }
              >
                <Printer size={15} aria-hidden="true" /> {tr('Έντυπο')}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
