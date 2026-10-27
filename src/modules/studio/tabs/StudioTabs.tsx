import {STUDIO_TABS as TABS, type StudioTabDef as TabDef, type Tab} from '../studioMeta';
import type {StudioPageState} from '../useStudioPage';
import {isOwnerOnlyTab} from '../../../core/ownerOnlySections';

const GROUPS = [
  {id: 'PLATFORM', el: 'Πλατφόρμα', en: 'Platform'},
  {id: 'SETUP', el: 'Διαμόρφωση', en: 'Set-up'},
] as const;
/** The platform tabs that exist only with the real hospitals (not in Demo). */
const PRODUCTION_ONLY: Tab[] = ['IMPORT', 'RATINGS', 'NOTICES', 'ERRORS'];

export default function StudioTabs({s}: {s: StudioPageState}) {
  const {L, libs, platformAdmin, selectTab, tab} = s;
  // The Sterilization flow, the roles and the settings are the platform owner's.
  const shown = TABS.filter(
    t =>
      (t.group === 'SETUP' || platformAdmin) &&
      (platformAdmin || !isOwnerOnlyTab(t.id)) &&
      (!PRODUCTION_ONLY.includes(t.id) || libs.dataMode === 'PRODUCTION'),
  );
  const groups = GROUPS.map(g => ({...g, tabs: shown.filter(t => t.group === g.id)})).filter(g => g.tabs.length);
  const row = (tabs: TabDef[]) =>
    tabs.map(t => (
      <button
        key={t.id}
        role="tab"
        aria-selected={tab === t.id}
        className={tab === t.id ? 'active' : ''}
        onClick={() => selectTab(t.id)}
      >
        <t.icon size={17} />
        {L(t.el, t.en)}
      </button>
    ));
  if (groups.length === 1)
    return (
      <div className="studio-tabs" role="tablist">
        {row(groups[0].tabs)}
      </div>
    );
  return (
    <div className="studio-tab-rows">
      {groups.map(g => (
        <div key={g.id} className="studio-tab-row">
          <span className="studio-tab-group" id={`studio-tabs-${g.id.toLowerCase()}`}>
            {L(g.el, g.en)}
          </span>
          <div className="studio-tabs" role="tablist" aria-labelledby={`studio-tabs-${g.id.toLowerCase()}`}>
            {row(g.tabs)}
          </div>
        </div>
      ))}
    </div>
  );
}
