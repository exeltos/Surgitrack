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
  Bug,
  Megaphone,
} from 'lucide-react';
import type {StudioPageState} from '../useStudioPage';

export default function StudioTabs({s}: {s: StudioPageState}) {
  const {L, libs, platformAdmin, selectTab, tab} = s;
  return (
    <div className="studio-tabs" role="tablist">
      {platformAdmin && (
        <button
          role="tab"
          aria-selected={tab === 'OVERVIEW'}
          className={tab === 'OVERVIEW' ? 'active' : ''}
          onClick={() => selectTab('OVERVIEW')}
        >
          <Gauge size={17} />
          {L('Επισκόπηση', 'Overview')}
        </button>
      )}
      {platformAdmin && (
        <button
          role="tab"
          aria-selected={tab === 'PLATFORM'}
          className={tab === 'PLATFORM' ? 'active' : ''}
          onClick={() => selectTab('PLATFORM')}
        >
          <Building2 size={17} />
          {L('Νοσοκομεία & Demo', 'Hospitals & Demo')}
        </button>
      )}
      <button
        role="tab"
        aria-selected={tab === 'LIBRARIES'}
        className={tab === 'LIBRARIES' ? 'active' : ''}
        onClick={() => selectTab('LIBRARIES')}
      >
        <BookOpen size={17} />
        {L('Βιβλιοθήκες', 'Libraries')}
      </button>
      <button
        role="tab"
        aria-selected={tab === 'WORKFLOW'}
        className={tab === 'WORKFLOW' ? 'active' : ''}
        onClick={() => selectTab('WORKFLOW')}
      >
        <Layers3 size={17} />
        {L('Ροή Αποστείρωσης', 'Sterilization Flow')}
      </button>
      {platformAdmin && (
        <button
          role="tab"
          aria-selected={tab === 'USERS'}
          className={tab === 'USERS' ? 'active' : ''}
          onClick={() => selectTab('USERS')}
        >
          <Users size={17} />
          {L('Χρήστες', 'Users')}
        </button>
      )}
      {platformAdmin && libs.dataMode === 'PRODUCTION' && (
        <button
          role="tab"
          aria-selected={tab === 'IMPORT'}
          className={tab === 'IMPORT' ? 'active' : ''}
          onClick={() => selectTab('IMPORT')}
        >
          <FileSpreadsheet size={17} />
          {L('Εισαγωγή', 'Import')}
        </button>
      )}
      {platformAdmin && libs.dataMode === 'PRODUCTION' && (
        <button
          role="tab"
          aria-selected={tab === 'ERRORS'}
          className={tab === 'ERRORS' ? 'active' : ''}
          onClick={() => selectTab('ERRORS')}
        >
          <Bug size={17} />
          {L('Σφάλματα', 'Errors')}
        </button>
      )}
      {platformAdmin && libs.dataMode === 'PRODUCTION' && (
        <button
          role="tab"
          aria-selected={tab === 'NOTICES'}
          className={tab === 'NOTICES' ? 'active' : ''}
          onClick={() => selectTab('NOTICES')}
        >
          <Megaphone size={17} />
          {L('Ειδοποιήσεις', 'Notices')}
        </button>
      )}
      <button
        role="tab"
        aria-selected={tab === 'GUIDE'}
        className={tab === 'GUIDE' ? 'active' : ''}
        onClick={() => selectTab('GUIDE')}
      >
        <ShieldCheck size={17} />
        {L('Ρόλοι', 'Roles')}
      </button>
      <button
        role="tab"
        aria-selected={tab === 'ROLES'}
        className={tab === 'ROLES' ? 'active' : ''}
        onClick={() => selectTab('ROLES')}
      >
        <UserCog size={17} />
        {L('Δικαιώματα', 'Permissions')}
      </button>
      <button
        role="tab"
        aria-selected={tab === 'SYSTEM'}
        className={tab === 'SYSTEM' ? 'active' : ''}
        onClick={() => selectTab('SYSTEM')}
      >
        <Settings2 size={17} />
        {L('Ρυθμίσεις', 'Settings')}
      </button>
    </div>
  );
}
