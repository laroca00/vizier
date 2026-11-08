-- Seconds into the game of each purchase, aligned with purchase_order.
ALTER TABLE participant_stats ADD COLUMN purchase_times TEXT;

-- Sum of the first completion time of a finished item over the games that
-- carried a timeline. Divide by games for the average. Rows for old patches
-- are deleted with their counts.
CREATE TABLE item_time_sums (
  patch TEXT NOT NULL,
  team_position TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  item_id INTEGER NOT NULL,
  games INTEGER NOT NULL,
  seconds INTEGER NOT NULL,
  PRIMARY KEY (patch, team_position, champion_id, item_id)
) WITHOUT ROWID;
