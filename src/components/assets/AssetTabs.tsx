export type AssetTab = 'SUMMARY' | 'CONTENTS' | 'PHOTOS' | 'HISTORY' | 'ISSUES' | 'NOTES';
const baseTabs: Array<{id: AssetTab; label: string}> = [
  {id: 'HISTORY', label: 'Ιστορικό'},
  {id: 'ISSUES', label: 'Εκκρεμότητες'},
  {id: 'SUMMARY', label: 'Σύνοψη'},
  {id: 'NOTES', label: 'Σημειώσεις'},
];
export default function AssetTabs({
  value,
  onChange,
  issueCount = 0,
  showContents = false,
  className = '',
}: {
  value: AssetTab;
  onChange: (tab: AssetTab) => void;
  issueCount?: number;
  showContents?: boolean;
  className?: string;
}) {
  const tabs = showContents
    ? [
        {id: 'CONTENTS' as AssetTab, label: 'Σύνθεση'},
        {id: 'HISTORY' as AssetTab, label: 'Ιστορικό'},
        {id: 'ISSUES' as AssetTab, label: 'Εκκρεμότητες'},
        {id: 'SUMMARY' as AssetTab, label: 'Σύνοψη'},
        {id: 'NOTES' as AssetTab, label: 'Σημειώσεις'},
      ]
    : baseTabs;
  return (
    <div className={`asset-side-tabs ${className}`.trim()}>
      {tabs.map(tab => (
        <button
          type="button"
          key={tab.id}
          className={value === tab.id ? 'active' : ''}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.id === 'ISSUES' && issueCount > 0 && <b>{issueCount}</b>}
        </button>
      ))}
    </div>
  );
}
