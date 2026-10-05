import {useState} from 'react';
import {ChevronDown, ChevronRight, TriangleAlert} from 'lucide-react';
import type {Issue, Tool} from '../../types/domain';
import {tr, trData} from '../../i18n';

/**
 * A Set's instruments under it in the batch receipt, so what arrives can be seen against what the
 * Set holds. Open issues show on their row; a problem found now is reported from the row.
 */
export default function BatchSetTools({
  tools,
  issues,
  onReport,
}: {
  tools: Tool[];
  issues: Issue[];
  onReport: (toolId: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name, 'el') || a.barcode.localeCompare(b.barcode));
  return (
    <div className="batch-set-tools">
      <button type="button" className="batch-set-tools-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {tr('Εργαλεία του Σετ')} <b>{tools.length}</b>
      </button>
      {open &&
        (sorted.length ? (
          <ul>
            {sorted.map(tool => {
              const openIssues = issues.filter(i => i.status === 'OPEN' && i.asset.startsWith(tool.barcode));
              return (
                <li key={tool.id} className={openIssues.length ? 'has-issue' : ''}>
                  <span className="mono">{tool.barcode}</span>
                  <strong title={tool.name}>{tool.name}</strong>
                  <span>{tool.code || '—'}</span>
                  <span className="batch-set-tools-state">
                    {openIssues.map(i => (
                      <em key={i.id}>
                        <TriangleAlert size={11} />
                        {trData(i.type)}
                      </em>
                    ))}
                  </span>
                  <button type="button" onClick={() => onReport(tool.id)}>
                    {tr('Αναφορά')}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p>{tr('Το Σετ δεν έχει καταχωρημένα εργαλεία.')}</p>
        ))}
    </div>
  );
}
