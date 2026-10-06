import AssetImportWizard from '../studio/AssetImportWizard';
import PageHeader from '../../components/ui/PageHeader';
import {useSurgi} from '../../store/SurgiStore';
import {useLibraries} from '../../core/LibraryStore';
import {useAppPreferences} from '../../core/AppPreferences';

/**
 * Bulk import inside a hospital, for its admin and its sterilization supervisor: the Studio wizard,
 * fixed to the open hospital and its departments.
 */
export default function ImportPage() {
  const {organizationId, organizationName, currentUser} = useSurgi();
  const {departments} = useLibraries();
  const {lang} = useAppPreferences();
  if (!organizationId)
    return (
      <div className="import-page">
        <PageHeader
          eyebrow={lang === 'el' ? 'ΝΟΣΟΚΟΜΕΙΟ' : 'HOSPITAL'}
          title={lang === 'el' ? 'Μαζική εισαγωγή' : 'Bulk import'}
        />
        <div className="devices-empty">
          {lang === 'el'
            ? 'Η μαζική εισαγωγή γίνεται μέσα σε νοσοκομείο. Επιλέξτε νοσοκομείο από την πάνω μπάρα.'
            : 'Bulk import works inside a hospital. Choose a hospital in the top bar.'}
        </div>
      </div>
    );
  return (
    <div className="import-page">
      <AssetImportWizard
        lang={lang === 'en' ? 'en' : 'el'}
        organizations={[{id: organizationId, name: organizationName || ''}]}
        departments={departments.map(d => ({organizationId, name: d.el, code: d.code || '', active: true}))}
        byName={currentUser.name}
        asPage
      />
    </div>
  );
}
