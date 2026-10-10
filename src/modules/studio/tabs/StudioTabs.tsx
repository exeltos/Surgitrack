import {
  BookOpen,
  Building2,
  Bug,
  FileSpreadsheet,
  Gauge,
  Layers3,
  Megaphone,
  Settings2,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type {Tab} from '../studioMeta';
import type {StudioPageState} from '../useStudioPage';

type TabDef = {id: Tab; el: string; en: string; icon: LucideIcon; group: 'PLATFORM' | 'SETUP'};

/**
 * The platform's own work first (hospitals, users, notices…), then the set-up every hospital has
 * (libraries, flow, roles, settings). A hospital admin sees only the set-up, on one row.
 */
const TABS: TabDef[] = [
  {id: 'OVERVIEW', el: 'Επισκόπηση', en: 'Overview', icon: Gauge, group: 'PLATFORM'},
  {id: 'PLATFORM', el: 'Νοσοκομεία & Demo', en: 'Hospitals & Demo', icon: Building2, group: 'PLATFORM'},
  {id: 'USERS', el: 'Χρήστες', en: 'Users', icon: Users, group: 'PLATFORM'},
  {id: 'IMPORT', el: 'Εισαγωγή', en: 'Import', icon: FileSpreadsheet, group: 'PLATFORM'},
  {id: 'NOTICES', el: 'Ειδοποιήσεις', en: 'Notices', icon: Megaphone, group: 'PLATFORM'},
  {id: 'ERRORS', el: 'Σφάλματα', en: 'Errors', icon: Bug, group: 'PLATFORM'},
  {id: 'LIBRARIES', el: 'Βιβλιοθήκες', en: 'Libraries', icon: BookOpen, group: 'SETUP'},
  {id: 'WORKFLOW', el: 'Ροή Αποστείρωσης', en: 'Sterilization Flow', icon: Layers3, group: 'SETUP'},
  {id: 'ROLES', el: 'Ρόλοι & δικαιώματα', en: 'Roles & permissions', icon: UserCog, group: 'SETUP'},
  {id: 'SYSTEM', el: 'Ρυθμίσεις', en: 'Settings', icon: Settings2, group: 'SETUP'},
];
const GROUPS = [
  {id: 'PLATFORM', el: 'Πλατφόρμα', en: 'Platform'},
  {id: 'SETUP', el: 'Διαμόρφωση', en: 'Set-up'},
] as const;
/** The platform tabs that exist only with the real hospitals (not in Demo). */
const PRODUCTION_ONLY: Tab[] = ['IMPORT', 'NOTICES', 'ERRORS'];

export default function StudioTabs({s}: {s: StudioPageState}) {
  const {L, libs, platformAdmin, selectTab, tab} = s;
  const shown = TABS.filter(
    t => (t.group === 'SETUP' || platformAdmin) && (!PRODUCTION_ONLY.includes(t.id) || libs.dataMode === 'PRODUCTION'),
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
