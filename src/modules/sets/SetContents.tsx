import {useMemo} from 'react';
import {Link} from 'react-router-dom';
import {ChevronDown, ChevronRight, Layers3, List, Plus} from 'lucide-react';
import type {Issue, SetAsset, Tool} from '../../types/domain';
import StatusBadge from '../../components/ui/StatusBadge';
import AppButton from '../../components/ui/AppButton';
import IconToggleButton from '../../components/ui/IconToggleButton';
import AssetFilterBar from '../../components/assets/AssetFilterBar';
import ColorMarker from '../../components/assets/ColorMarker';
import {sameMarker} from '../../core/colorTapes';
import {useRememberedState} from '../../core/listMemory';
import {useSurgi} from '../../store/SurgiStore';
import {tr} from '../../i18n';

/** The Set page's Contents tab: its physical instruments, one by one or grouped, with search and filters. */
export default function SetContents({
  set,
  members,
  memberIssues,
  workflowLocked,
  expandedGroups,
  setExpandedGroups,
  onAddTools,
}: {
  set: SetAsset;
  members: Tool[];
  memberIssues: Issue[];
  workflowLocked: boolean;
  expandedGroups: Set<string>;
  setExpandedGroups: (update: (current: Set<string>) => Set<string>) => void;
  onAddTools: () => void;
}) {
  const {can} = useSurgi();
  const [grouped, setGrouped] = useRememberedState('grouped', false);
  const [toolQuery, setToolQuery] = useRememberedState('toolQuery', '');
  const [toolManufacturer, setToolManufacturer] = useRememberedState('toolManufacturer', '');
  const [toolSpecialty, setToolSpecialty] = useRememberedState('toolSpecialty', '');
  const [toolState, setToolState] = useRememberedState('toolState', '');
  const visibleMembers = useMemo(
    () =>
      members.filter(
        tool =>
          (!toolManufacturer || tool.manufacturer === toolManufacturer) &&
          (!toolSpecialty || tool.specialty === toolSpecialty) &&
          (!toolState || tool.state === toolState) &&
          `${tool.name} ${tool.code} ${tool.barcode} ${tool.serialNumber || ''} ${tool.manufacturer} ${tool.specialty} ${tool.department || ''}`
            .toLowerCase()
            .includes(toolQuery.toLowerCase()),
      ),
    [members, toolQuery, toolManufacturer, toolSpecialty, toolState],
  );
  const groupedMembers = useMemo(() => {
    const map = new Map<string, typeof visibleMembers>();
    visibleMembers.forEach(tool => {
      const key = `${tool.code}|${tool.name}|${tool.manufacturer}`;
      map.set(key, [...(map.get(key) || []), tool]);
    });
    return [...map.entries()];
  }, [visibleMembers]);
  const memberValues = (key: 'manufacturer' | 'specialty' | 'state') =>
    [...new Set(members.map(tool => String(tool[key] || '')).filter(Boolean))].sort();
  const toggleGroup = (key: string) =>
    setExpandedGroups(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const missing = Math.max(0, set.expected - members.length);
  const complete = missing === 0;

  return (
    <section className="asset-section set-composition-fixed asset-detail-full-panel">
      <div className="asset-section-head set-composition-head">
        <div>
          <span className="eyebrow">{tr('ΣΥΝΘΕΣΗ ΣΕΤ')}</span>
          <h2>{tr('Φυσικά εργαλεία')}</h2>
          <p>{tr('Κάθε barcode είναι ξεχωριστό φυσικό εργαλείο.')}</p>
        </div>
        <div className="set-composition-actions">
          {can('asset.composition.manage') && (
            <AppButton
              icon={<Plus size={18} />}
              disabled={workflowLocked}
              title={
                workflowLocked
                  ? tr('Η σύνθεση δεν αλλάζει όσο το Σετ βρίσκεται σε ενεργή διαδικασία αποστείρωσης.')
                  : undefined
              }
              onClick={onAddTools}
            >
              <span className="label-wide">{tr('Προσθήκη εργαλείων')}</span>
              <span className="label-narrow">{tr('Προσθήκη')}</span>
            </AppButton>
          )}
          <IconToggleButton
            active={grouped}
            activeIcon={<List size={18} />}
            inactiveIcon={<Layers3 size={18} />}
            activeTitle={tr('Εμφάνιση φυσικών εγγραφών')}
            inactiveTitle={tr('Ομαδοποίηση ίδιων εργαλείων')}
            aria-label={grouped ? tr('Εμφάνιση φυσικών εγγραφών') : tr('Ομαδοποίηση ίδιων εργαλείων')}
            onClick={() => setGrouped(value => !value)}
          />
          <div className={`asset-count-state ${complete ? 'ok' : 'warning'}`}>
            <strong>
              {members.length}/{set.expected}
            </strong>
            <span>{complete ? tr('Πλήρες') : tr('Έλλειψη {0}', missing)}</span>
          </div>
        </div>
      </div>
      <AssetFilterBar
        compact
        className="set-composition-filters"
        query={toolQuery}
        onQueryChange={setToolQuery}
        placeholder={tr('Εργαλείο, κωδικός, barcode ή serial...')}
        filters={[
          {
            key: 'specialty',
            value: toolSpecialty,
            placeholder: tr('Όλες οι ειδικότητες'),
            options: memberValues('specialty').map(value => ({value, label: value})),
            onChange: setToolSpecialty,
          },
          {
            key: 'manufacturer',
            value: toolManufacturer,
            placeholder: tr('Όλες οι εταιρείες'),
            options: memberValues('manufacturer').map(value => ({value, label: value})),
            onChange: setToolManufacturer,
          },
          {
            key: 'state',
            value: toolState,
            placeholder: tr('Όλες οι καταστάσεις'),
            options: memberValues('state').map(value => ({value, label: value})),
            onChange: setToolState,
          },
        ]}
      />
      <div className="set-tool-list">
        {grouped
          ? groupedMembers.map(([key, group], groupIndex) => {
              const first = group[0];
              const open = expandedGroups.has(key);
              const groupHasIssue = group.some(tool =>
                memberIssues.some(issue => issue.asset.startsWith(tool.barcode)),
              );
              return (
                <div className="set-tool-group" key={key}>
                  <button
                    className={`set-tool-row set-tool-group-row ${groupHasIssue ? 'has-issue' : ''}`}
                    onClick={() => toggleGroup(key)}
                  >
                    <span className="set-tool-index">{groupIndex + 1}</span>
                    <div className="set-tool-code">
                      <strong className="qty-inline">
                        {group.length} {tr('τεμ.')}
                      </strong>
                      <small>{first.code}</small>
                    </div>
                    <div className="set-tool-name">
                      <strong>{first.name}</strong>
                      <small>
                        {first.manufacturer} · {open ? tr('Απόκρυψη φυσικών barcodes') : tr('Προβολή φυσικών barcodes')}
                      </small>
                    </div>
                    <div className="set-tool-uses">
                      <span>{tr('Ομάδα')}</span>
                      <strong>{group.length}</strong>
                    </div>
                    <div className="set-tool-state">
                      <span className="group-disclosure">
                        {open ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </span>
                      {groupHasIssue && <small>{tr('Υπάρχει αναφορά')}</small>}
                    </div>
                  </button>
                  {open && (
                    <div className="set-tool-group-children">
                      {group.map((tool, index) => {
                        const hasIssue = memberIssues.some(issue => issue.asset.startsWith(tool.barcode));
                        return (
                          <Link
                            to={`/tools/${tool.id}`}
                            className={`set-tool-row set-tool-child-row ${hasIssue ? 'has-issue' : ''}`}
                            key={tool.id}
                          >
                            <span className="set-tool-index">{index + 1}</span>
                            <div className="set-tool-code">
                              <strong className="mono">{tool.barcode}</strong>
                              <small>{tool.code}</small>
                            </div>
                            <div className="set-tool-name">
                              <strong title={tool.name}>{tool.name}</strong>
                              <small>{tool.serialNumber ? `S/N ${tool.serialNumber}` : tr('Χωρίς serial')}</small>
                            </div>
                            <div className="set-tool-uses">
                              <span>{tr('Χρήσεις')}</span>
                              <strong>
                                {tool.maxUses
                                  ? tr('{0}/{1} χρήσεις', tool.uses, tool.maxUses)
                                  : tr('{0} χρήσεις', tool.uses)}
                              </strong>
                            </div>
                            <div className="set-tool-state">
                              <MemberMarker tool={tool} set={set} />
                              {tool.state !== set.state && <StatusBadge value={tool.state} />}
                              {hasIssue && <small>{tr('Ανοικτή αναφορά')}</small>}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          : visibleMembers.map((tool, index) => {
              const hasIssue = memberIssues.some(issue => issue.asset.startsWith(tool.barcode));
              return (
                <Link to={`/tools/${tool.id}`} className={`set-tool-row ${hasIssue ? 'has-issue' : ''}`} key={tool.id}>
                  <span className="set-tool-index">{index + 1}</span>
                  <div className="set-tool-code">
                    <strong className="mono">{tool.barcode}</strong>
                    <small>{tool.code}</small>
                  </div>
                  <div className="set-tool-name">
                    <strong title={tool.name}>{tool.name}</strong>
                    <small>
                      {tool.manufacturer}
                      {tool.serialNumber ? ` · S/N ${tool.serialNumber}` : ''}
                    </small>
                  </div>
                  <div className="set-tool-uses">
                    <span>{tr('Χρήσεις')}</span>
                    <strong>
                      {tool.maxUses ? tr('{0}/{1} χρήσεις', tool.uses, tool.maxUses) : tr('{0} χρήσεις', tool.uses)}
                    </strong>
                  </div>
                  <div className="set-tool-state">
                    <MemberMarker tool={tool} set={set} />
                    {tool.state !== set.state && <StatusBadge value={tool.state} />}
                    {hasIssue && <small>{tr('Ανοικτή αναφορά')}</small>}
                  </div>
                </Link>
              );
            })}
      </div>
    </section>
  );
}

/** In the Set's composition: an instrument whose color differs from the Set's, or that has none. */
function MemberMarker({tool, set}: {tool: Tool; set: SetAsset}) {
  const setTapes = set.colorTapes || [];
  if (tool.colorMode === 'OWN' && tool.colorTapes?.length && !sameMarker(tool.colorTapes, setTapes))
    return (
      <span className="member-marker differs" title={tr('Δικό του χρώμα, διαφορετικό από το Σετ')}>
        <ColorMarker tapes={tool.colorTapes} size="sm" />
        <small>{tr('Άλλο χρώμα')}</small>
      </span>
    );
  if (tool.colorMode === 'NONE' && setTapes.length)
    return (
      <span className="member-marker none">
        <small>{tr('Χωρίς ταινία')}</small>
      </span>
    );
  return null;
}
