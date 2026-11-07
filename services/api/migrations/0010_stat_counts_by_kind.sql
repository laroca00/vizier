-- Tier lists read the pool kinds across every champion and role. Without
-- this they scan every build count for the patch; with it they read only
-- the few thousand pool rows.
CREATE INDEX stat_counts_by_kind ON stat_counts (kind, queue_id, patch, champion_id);
