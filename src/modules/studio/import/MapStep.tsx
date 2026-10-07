import AppButton from '../../../components/ui/AppButton';
import {IMPORT_FIELDS} from '../assetImport';
import {autoMapping} from '../assetImport';
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
  } = s;
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
              value={mapping[field.key]}
              onChange={e => setMapping(m => ({...m, [field.key]: Number(e.target.value)}))}
            >
              <option value={-1}>{L('— Χωρίς —', '— None —')}</option>
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h || L(`Στήλη ${i + 1}`, `Column ${i + 1}`)}
                </option>
              ))}
            </select>
            <em>{mapping[field.key] >= 0 ? sample.map(r => r[mapping[field.key]] || '·').join(' | ') : ''}</em>
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
