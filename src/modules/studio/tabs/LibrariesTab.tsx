import {useState} from 'react';
import {Plus, Search, Trash2, Pencil, Palette, ListPlus, ClipboardCheck} from 'lucide-react';
import {countDepartments} from '../../../core/surgicalCount';
import AppButton from '../../../components/ui/AppButton';
import ColorTapeLibrary from '../ColorTapeLibrary';
import SterilizerBatchDialog from '../SterilizerBatchDialog';
import {defaultSterilizerNaming} from '../../../core/sterilizerNaming';
import {translateToEnglish} from '../../../core/glossary';
import type {StudioPageState} from '../useStudioPage';

export default function LibrariesTab({s}: {s: StudioPageState}) {
  const {
    L,
    cloudError,
    currentMeta,
    filteredItems,
    hospitalLibraryMeta,
    libraryKey,
    libs,
    query,
    resetQuery,
    setConfirm,
    setEditItem,
    setLibraryKey,
    setNewItem,
    setQuery,
    setTapesOpen,
    tab,
    tapesOpen,
  } = s;
  const [batchOpen, setBatchOpen] = useState(false);
  // Departments that count the instruments when sending to Sterilization (operating theatres).
  const counting = countDepartments(
    libs.departments.map(item => item.el),
    libs.systemSettings.surgicalCountDepartments,
  );
  const toggleCounting = (name: string) =>
    libs.updateSystemSettings(
      {
        surgicalCountDepartments: counting.includes(name)
          ? counting.filter(item => item !== name)
          : [...counting, name],
      },
      undefined,
      'Καταμέτρηση χειρουργείου',
    );
  const naming = libs.systemSettings.sterilizerNaming || defaultSterilizerNaming;
  return (
    <>
      {tab === 'LIBRARIES' && (
        <div className="studio-manager">
          <aside className="studio-manager-nav">
            {hospitalLibraryMeta.map(m => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  className={!tapesOpen && libraryKey === m.key ? 'active' : ''}
                  onClick={() => {
                    setTapesOpen(false);
                    setLibraryKey(m.key);
                    resetQuery();
                  }}
                >
                  <span>
                    <Icon size={18} />
                  </span>
                  <div>
                    <b>{L(m.el, m.en)}</b>
                    <small>
                      {libs[m.key].length} {L('εγγραφές', 'records')}
                    </small>
                  </div>
                </button>
              );
            })}
            <button className={tapesOpen ? 'active' : ''} onClick={() => setTapesOpen(true)}>
              <span>
                <Palette size={18} />
              </span>
              <div>
                <b>{L('Χρωματικοί μάρτυρες', 'Color markers')}</b>
                <small>
                  {(libs.colorTapes || []).filter(t => t.active !== false).length} {L('σε χρήση', 'in use')}
                </small>
              </div>
            </button>
          </aside>
          {tapesOpen ? (
            <section className="studio-manager-panel">
              <ColorTapeLibrary />
            </section>
          ) : (
            <section className="studio-manager-panel">
              <header className="studio-panel-head">
                <div>
                  <span className="eyebrow">{L('ΒΙΒΛΙΟΘΗΚΗ', 'LIBRARY')}</span>
                  <h2>{L(currentMeta.el, currentMeta.en)}</h2>
                  <p>{L(currentMeta.hintEl, currentMeta.hintEn)}</p>
                </div>
                <div className="studio-panel-actions">
                  {libraryKey === 'sterilizers' && (
                    <AppButton onClick={() => setBatchOpen(true)}>
                      <ListPlus size={16} />
                      {L('Προσθήκη κλιβάνων', 'Add sterilizers')}
                    </AppButton>
                  )}
                  <AppButton variant="primary" onClick={() => setNewItem(true)}>
                    <Plus size={16} />
                    {L('Νέα εγγραφή', 'New record')}
                  </AppButton>
                </div>
              </header>
              {cloudError && <div className="auth-message">{cloudError}</div>}
              <div className="studio-search">
                <Search size={17} />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={L('Αναζήτηση ονομασίας ή κωδικού...', 'Search name or code...')}
                />
              </div>
              <div className={`studio-list-head${libraryKey === 'departments' ? ' with-count' : ''}`}>
                <span>{L('Ονομασία', 'Name')}</span>
                <span>{L('Αγγλικά', 'English')}</span>
                <span>{L('Κωδικός', 'Code')}</span>
                <span></span>
              </div>
              <div className="studio-scroll-list">
                {filteredItems.map(item => (
                  <div className={`studio-list-row${libraryKey === 'departments' ? ' with-count' : ''}`} key={item.id}>
                    <strong>{item.el}</strong>
                    <span>{item.en}</span>
                    <code>{item.code || '—'}</code>
                    <div>
                      {libraryKey === 'departments' && (
                        <button
                          type="button"
                          className={`studio-count-toggle ${counting.includes(item.el) ? 'on' : ''}`}
                          aria-pressed={counting.includes(item.el)}
                          title={L(
                            'Καταμέτρηση εργαλείων κατά την αποστολή προς Αποστείρωση (χειρουργείο)',
                            'Instrument count when sending to Sterilization (operating theatre)',
                          )}
                          onClick={() => toggleCounting(item.el)}
                        >
                          <ClipboardCheck size={15} />
                          {L('Καταμέτρηση', 'Count')}
                        </button>
                      )}
                      <button title={L('Επεξεργασία', 'Edit')} onClick={() => setEditItem(item)}>
                        <Pencil size={16} />
                      </button>
                      <button
                        className="danger-icon"
                        title={L('Διαγραφή', 'Delete')}
                        onClick={() =>
                          setConfirm({
                            title: L('Διαγραφή εγγραφής;', 'Delete record?'),
                            message: L(
                              `Η εγγραφή «${item.el}» θα αφαιρεθεί από τη βιβλιοθήκη και θα μείνει στον Κάδο για 30 ημέρες.`,
                              `“${item.en}” will be removed from the library and stay in the bin for 30 days.`,
                            ),
                            action: () => libs.removeItem(libraryKey, item.id),
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {!filteredItems.length && (
                  <div className="studio-empty">{L('Δεν βρέθηκαν εγγραφές.', 'No records found.')}</div>
                )}
              </div>
            </section>
          )}
        </div>
      )}
      {batchOpen && (
        <SterilizerBatchDialog
          naming={naming}
          existing={libs.sterilizers.map(item => item.el)}
          onClose={() => setBatchOpen(false)}
          onSave={(next, names) => {
            const english = translateToEnglish(next.base) || next.base;
            libs.updateSystemSettings({sterilizerNaming: next}, undefined, 'Ονομασία κλιβάνων');
            libs.addItems(
              'sterilizers',
              names.map(item => ({el: item.name, en: `${english} ${item.mark}`, code: `ST-${item.mark}`})),
            );
            setBatchOpen(false);
          }}
        />
      )}
    </>
  );
}
