import type {ReactNode} from 'react';
import {PackageOpen, SearchX} from 'lucide-react';
import AppButton from './AppButton';
import {tr} from '../../i18n';

/** What a page shows in place of an empty list: a title, a hint and the next step. */
export default function EmptyState({
  icon,
  title,
  description,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state" role="status">
      <span className="empty-state-icon">{icon ?? <PackageOpen size={22} />}</span>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actions && <div className="empty-state-actions">{actions}</div>}
    </div>
  );
}

/**
 * The empty state of a filtered list: when the list has nothing at all, `none` explains and offers
 * the first step; when filters hide everything, it says so and offers to clear them.
 */
export function ListEmpty({
  total,
  none,
  onClear,
}: {
  total: number;
  none: {title: string; description?: string; actions?: ReactNode};
  onClear: () => void;
}) {
  if (total === 0) return <EmptyState {...none} />;
  return (
    <EmptyState
      icon={<SearchX size={22} />}
      title={tr('Κανένα αποτέλεσμα')}
      description={tr('Τίποτα δεν ταιριάζει στην αναζήτηση ή στα φίλτρα. Δοκίμασε να τα αλλάξεις ή να τα καθαρίσεις.')}
      actions={<AppButton onClick={onClear}>{tr('Καθαρισμός φίλτρων')}</AppButton>}
    />
  );
}
