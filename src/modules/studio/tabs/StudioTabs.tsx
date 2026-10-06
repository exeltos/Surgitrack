import {
  BookOpen,
  Building2,
  Gauge,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
  Layers3,
  FileSpreadsheet,
} from 'lucide-react';
import type {StudioPageState} from '../useStudioPage';

export default function StudioTabs({s}: {s: StudioPageState}) {
  const {L, libs, platformAdmin, selectTab, tab} = s;
  return (
    <div className="studio-tabs" role="tablist">
      {platformAdmin && (
        <button className={tab === 'OVERVIEW' ? 'active' : ''} onClick={() => selectTab('OVERVIEW')}>
          <Gauge size={17} />
          {L('Επισκόπηση', 'Overview')}
        </button>
      )}
      {platformAdmin && (
        <button className={tab === 'PLATFORM' ? 'active' : ''} onClick={() => selectTab('PLATFORM')}>
          <Building2 size={17} />
          {L('Νοσοκομεία & Demo', 'Hospitals & Demo')}
        </button>
      )}
      <button className={tab === 'LIBRARIES' ? 'active' : ''} onClick={() => selectTab('LIBRARIES')}>
        <BookOpen size={17} />
        {L('Βιβλιοθήκες', 'Libraries')}
      </button>
      <button className={tab === 'WORKFLOW' ? 'active' : ''} onClick={() => selectTab('WORKFLOW')}>
        <Layers3 size={17} />
        {L('Ροή Αποστείρωσης', 'Sterilization Flow')}
      </button>
      {platformAdmin && (
        <button className={tab === 'USERS' ? 'active' : ''} onClick={() => selectTab('USERS')}>
          <Users size={17} />
          {L('Χρήστες', 'Users')}
        </button>
      )}
      {platformAdmin && libs.dataMode === 'PRODUCTION' && (
        <button className={tab === 'IMPORT' ? 'active' : ''} onClick={() => selectTab('IMPORT')}>
          <FileSpreadsheet size={17} />
          {L('Εισαγωγή', 'Import')}
        </button>
      )}
      <button className={tab === 'GUIDE' ? 'active' : ''} onClick={() => selectTab('GUIDE')}>
        <ShieldCheck size={17} />
        {L('Ρόλοι', 'Roles')}
      </button>
      <button className={tab === 'ROLES' ? 'active' : ''} onClick={() => selectTab('ROLES')}>
        <UserCog size={17} />
        {L('Δικαιώματα', 'Permissions')}
      </button>
      <button className={tab === 'SYSTEM' ? 'active' : ''} onClick={() => selectTab('SYSTEM')}>
        <Settings2 size={17} />
        {L('Ρυθμίσεις', 'Settings')}
      </button>
    </div>
  );
}
