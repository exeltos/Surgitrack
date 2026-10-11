-- release_transitions: an index for each foreign key (the advisor's unindexed_foreign_keys). Deleting a
-- hospital or a user otherwise scans the whole log to cascade or null the rows that point at it.
create index if not exists release_transitions_organization_id on public.release_transitions (organization_id);
create index if not exists release_transitions_changed_by on public.release_transitions (changed_by);
