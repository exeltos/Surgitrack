import {Download, FileSpreadsheet, Upload} from 'lucide-react';
import AppButton from '../../../components/ui/AppButton';
import {downloadXlsx} from '../../../core/exportTable';
import {templateTable} from '../assetImport';
import type {ImportState} from './useAssetImport';

export default function FileStep({s}: {s: ImportState}) {
  const {lang, L, dragging, openFile, organization, organizationId, setDragging} = s;
  return (
    <div className="asset-import-file">
      <div className="asset-import-start">
        <label
          className={`asset-import-drop${organizationId ? '' : ' disabled'}${dragging ? ' dragging' : ''}`}
          onDragOver={e => {
            if (!organizationId) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && organizationId) void openFile(file);
          }}
        >
          <span className="asset-import-drop-icon">
            <Upload size={24} />
          </span>
          <b>
            {organizationId
              ? L('Σύρετε εδώ το αρχείο ή πατήστε για επιλογή', 'Drop the file here or click to choose')
              : L('Επιλέξτε πρώτα νοσοκομείο (πάνω δεξιά)', 'Choose a hospital first (top right)')}
          </b>
          <small>
            {organizationId
              ? L(
                  `Excel (.xlsx) ή CSV · για «${organization?.name}»`,
                  `Excel (.xlsx) or CSV · for “${organization?.name}”`,
                )
              : '.xlsx · .csv'}
          </small>
          <input
            type="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            disabled={!organizationId}
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void openFile(file);
            }}
          />
        </label>
        <div className="asset-import-template">
          <FileSpreadsheet size={20} />
          <span>
            <b>{L('Δεν έχετε έτοιμο αρχείο;', 'No file ready?')}</b>
            <small>
              {L(
                'Κατεβάστε το πρότυπο και συμπληρώστε το. Ή ανεβάστε το δικό σας: στο επόμενο βήμα λέτε ποια στήλη είναι τι.',
                'Download the template and fill it in. Or upload your own: in the next step you say which column is what.',
              )}
            </small>
          </span>
          <AppButton onClick={() => downloadXlsx(templateTable(lang))}>
            <Download size={15} />
            {L('Πρότυπο Excel', 'Excel template')}
          </AppButton>
        </div>
      </div>

      <aside className="asset-import-guide">
        <b>{L('Πώς διαβάζεται το αρχείο', 'How the file is read')}</b>
        <small>{L('Μία γραμμή ανά εργαλείο. Παράδειγμα:', 'One row per instrument. For example:')}</small>
        <table>
          <thead>
            <tr>
              <th>{L('Σετ', 'Set')}</th>
              <th>{L('Εργαλείο', 'Instrument')}</th>
              <th>{L('Τμήμα', 'Department')}</th>
              <th>{L('Ποσ.', 'Qty')}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="set-a">
              <td>{L('Λαπαροτομίας 1', 'Laparotomy 1')}</td>
              <td>{L('Λαβίδα Kocher', 'Kocher forceps')}</td>
              <td>{L('Χειρουργείο', 'Theatre')}</td>
              <td>4</td>
            </tr>
            <tr className="set-a">
              <td>{L('Λαπαροτομίας 1', 'Laparotomy 1')}</td>
              <td>{L('Ψαλίδι Metzenbaum', 'Metzenbaum scissors')}</td>
              <td>{L('Χειρουργείο', 'Theatre')}</td>
              <td>2</td>
            </tr>
            <tr>
              <td className="blank">—</td>
              <td>{L('Άγκιστρο Farabeuf', 'Farabeuf retractor')}</td>
              <td>{L('ΜΕΘ', 'ICU')}</td>
              <td>1</td>
            </tr>
            <tr>
              <td className="blank">—</td>
              <td>{L('Λαβίδα Pean', 'Pean forceps')}</td>
              <td className="blank">—</td>
              <td>3</td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li>
            <i className="set-a" />
            {L(
              'Ίδιο όνομα Σετ = ένα Σετ: εδώ ένα Σετ με 6 εργαλεία (4 + 2).',
              'Same Set name = one Set: here one Set with 6 instruments (4 + 2).',
            )}
          </li>
          <li>
            <i />
            {L(
              'Χωρίς Σετ: μεμονωμένο εργαλείο του τμήματος, ή Απόθεμα αν δεν έχει τμήμα.',
              'No Set: a standalone instrument of its department, or Stock without one.',
            )}
          </li>
          <li>
            <i />
            {L(
              'Ποσότητα 4 = τέσσερα εργαλεία, καθένα με δικό του barcode. Όσα barcodes λείπουν δίνονται αυτόματα.',
              'Quantity 4 = four instruments, each with its own barcode. Missing barcodes are assigned for you.',
            )}
          </li>
          <li>
            <i />
            {L(
              'Δύο ίδια Σετ (π.χ. δύο «Λαπαροτομίας»): δώστε τους διαφορετικό όνομα ή barcode Σετ.',
              'Two identical Sets: give each its own name or Set barcode.',
            )}
          </li>
        </ul>
      </aside>
    </div>
  );
}
