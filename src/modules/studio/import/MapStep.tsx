import AppButton from '../../../components/ui/AppButton';
import {FIXED_FIELDS, IMPORT_FIELDS, type FixedField} from '../assetImport';
import {autoMapping} from '../assetImport';
import {useLibraries} from '../../../core/LibraryStore';
import type {ImportState} from './useAssetImport';

export default function MapStep({s}: {s: ImportState}) {
  const {
    lang,
    L,
    busy,
    check,
    fileName,
    filledRows,
    headerRow,
    headers,
    mappedName,
    mapping,
    reset,
    rows,
    sample,
    setHeaderRow,
    setMapping,
    fixed,
    setFixed,
    organizationDepartments,
  } = s;
  // A department or specialty the file does not say can be given here for every row.
  const {specialties} = useLibraries();
  const choicesFor: Record<FixedField, string[]> = {
    department: organizationDepartments.map(d => d.name),
    specialty: specialties.map(x => x.el),
  };
  const isFixed = (key: string): key is FixedField => (FIXED_FIELDS as readonly string[]).includes(key);
  return (
    <div className="asset-import-map">
      <p className="asset-import-lead">
        {L(
          `«${fileName}»: ${filledRows.length} γραμμές. Για κάθε πεδίο διαλέξτε τη στήλη του αρχείου σας (όσες αναγνωρίστηκαν είναι ήδη συμπληρωμένες).`,
          `“${fileName}”: ${filledRows.length} rows. For each field choose the column of your file (recognized ones are already filled in).`,
        )}
      </p>
      <label className="asset-import-header-row">
        {L('Γραμμή επικεφαλίδων', 'Header row')}
        <select
          value={headerRow}
          onChange={e => {
            const next = Number(e.target.value);
            setHeaderRow(next);
            setMapping(autoMapping(rows[next] || []));
          }}
        >
          {rows.slice(0, 10).map((row, i) =>
            row.some(Boolean) ? (
              <option key={i} value={i}>
                {i + 1}: {row.filter(Boolean).slice(0, 4).join(' · ')}
              </option>
            ) : null,
          )}
        </select>
      </label>
      <div className="asset-import-fields">
        {IMPORT_FIELDS.map(field => (
          <label key={field.key} className={field.required && mapping[field.key] < 0 ? 'missing' : ''}>
            <span>
              <b>
                {L(field.el, field.en)}
                {field.required ? ' *' : ''}
              </b>
              {(lang === 'el' ? field.hintEl : field.hintEn) && <small>{L(field.hintEl, field.hintEn)}</small>}
            </span>
            <select
              value={
                mapping[field.key] >= 0
                  ? String(mapping[field.key])
                  : isFixed(field.key) && fixed[field.key]
                    ? `=${fixed[field.key]}`
                    : '-1'
              }
              onChange={e => {
                const v = e.target.value;
                // «=Name»: that value for every row; a number: the file's column.
                if (isFixed(field.key)) setFixed(f => ({...f, [field.key]: v.startsWith('=') ? v.slice(1) : ''}));
                setMapping(m => ({...m, [field.key]: v.startsWith('=') ? -1 : Number(v)}));
              }}
            >
              <option value="-1">{L('— Χωρίς —', '— None —')}</option>
              <optgroup label={L('Στήλη του αρχείου', 'Column of the file')}>
                {headers.map((h, i) => (
                  <option key={i} value={String(i)}>
                    {h || L(`Στήλη ${i + 1}`, `Column ${i + 1}`)}
                  </option>
                ))}
              </optgroup>
              {isFixed(field.key) && choicesFor[field.key].length > 0 && (
                <optgroup label={L('Ίδιο σε όλες τις γραμμές', 'The same for every row')}>
                  {choicesFor[field.key].map(name => (
                    <option key={name} value={`=${name}`}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <em>
              {mapping[field.key] >= 0
                ? sample.map(r => r[mapping[field.key]] || '·').join(' | ')
                : isFixed(field.key) && fixed[field.key]
                  ? L('Σε όλες τις γραμμές', 'In every row')
                  : ''}
            </em>
          </label>
        ))}
      </div>
      <footer className="asset-import-actions">
        <AppButton onClick={reset}>{L('Άλλο αρχείο', 'Another file')}</AppButton>
        <AppButton variant="primary" disabled={!mappedName || Boolean(busy)} onClick={() => void check()}>
          {busy || L('Έλεγχος γραμμών', 'Check rows')}
        </AppButton>
      </footer>
    </div>
  );
}
