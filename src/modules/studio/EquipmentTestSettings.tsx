import {Printer} from 'lucide-react';
import {useLibraries} from '../../core/LibraryStore';
import {testKindsFor, testKindsOf} from '../../core/equipmentTests';
import type {EquipmentTestKind, LibraryItem, TestedEquipment} from '../../core/libraries';
import {useHasModule} from '../../data/cloud/modulesContext';
import {useSurgi} from '../../store/SurgiStore';
import {getI18nLang, tr, trData} from '../../i18n';
import {printDocumentInWindow} from '../sterilization/printUtils';
import {dailyTestLogHtml} from '../sterilization/printTestLog';

/**
 * Settings → Sterilization: the tests each sterilizer and washer is held to (a plasma sterilizer has no Bowie-Dick),
 * as a table, a machine per row and a test per column; and the day's test sheet of all of them.
 */
export default function EquipmentTestSettings() {
  const libs = useLibraries();
  const {organizationName} = useSurgi();
  const on = useHasModule('EQUIPMENT_TESTS');
  if (!on) return null;
  const en = getI18nLang() === 'en';
  const groups: Array<{
    key: 'sterilizers' | 'washers';
    equipment: TestedEquipment;
    title: string;
    items: LibraryItem[];
  }> = [
    {
      key: 'sterilizers',
      equipment: 'STERILIZER',
      title: tr('Κλίβανος'),
      items: libs.sterilizers.filter(i => i.active !== false),
    },
    {key: 'washers', equipment: 'WASHER', title: tr('Πλυντήριο'), items: libs.washers.filter(i => i.active !== false)},
  ];
  if (!groups.some(g => g.items.length)) return null;
  const toggle = (
    key: 'sterilizers' | 'washers',
    equipment: TestedEquipment,
    item: LibraryItem,
    id: EquipmentTestKind,
  ) => {
    const current = testKindsOf(item, equipment);
    libs.updateItem(key, item.id, {testKinds: current.includes(id) ? current.filter(k => k !== id) : [...current, id]});
  };
  const print = (equipment: TestedEquipment, items: LibraryItem[]) =>
    printDocumentInWindow(
      equipment === 'WASHER' ? tr('Ημερήσιο έντυπο δοκιμών πλυντηρίων') : tr('Ημερήσιο έντυπο δοκιμών κλιβάνων'),
      dailyTestLogHtml(organizationName || '', items, equipment, new Date(), libs.systemSettings.label),
    );
  return (
    <section className="equipment-test-settings">
      <header>
        <div>
          <strong>{tr('Δοκιμές εξοπλισμού')}</strong>
          <small>{tr('Ποιες δοκιμές κάνει ο καθένας· μόνο αυτές ζητούνται πριν τη φόρτωση.')}</small>
        </div>
      </header>
      {groups
        .filter(g => g.items.length)
        .map(group => {
          const kinds = testKindsFor(group.equipment);
          return (
            <div key={group.key} className="equipment-test-group">
              <table>
                <thead>
                  <tr>
                    <th>{group.title}</th>
                    {kinds.map(kind => (
                      <th key={kind.id}>{en ? kind.en : kind.el}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.items.map(item => {
                    const chosen = testKindsOf(item, group.equipment);
                    return (
                      <tr key={item.id}>
                        <td>{trData(item.el)}</td>
                        {kinds.map(kind => (
                          <td key={kind.id}>
                            <input
                              type="checkbox"
                              aria-label={`${trData(item.el)} · ${en ? kind.en : kind.el}`}
                              checked={chosen.includes(kind.id)}
                              onChange={() => toggle(group.key, group.equipment, item, kind.id)}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <button
                type="button"
                className="equipment-test-print"
                onClick={() => print(group.equipment, group.items)}
              >
                <Printer size={15} aria-hidden="true" />{' '}
                {group.equipment === 'WASHER' ? tr('Ημερήσιο έντυπο πλυντηρίων') : tr('Ημερήσιο έντυπο κλιβάνων')}
              </button>
            </div>
          );
        })}
    </section>
  );
}
