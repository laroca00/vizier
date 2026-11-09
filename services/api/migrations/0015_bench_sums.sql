-- Level at the end of each of the first 15 minutes, "1,2,3,...", from the
-- timeline when the crawler fetched one. Feeds the in-game benchmark.
ALTER TABLE participant_stats ADD COLUMN level_minutes TEXT;

-- Sums of CS and level at a few sample minutes over ranked games that carried
-- a timeline. Divide by games for the average. Rows for old patches are
-- deleted with their counts.
CREATE TABLE bench_sums (
  patch TEXT NOT NULL,
  team_position TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  minute INTEGER NOT NULL,
  games INTEGER NOT NULL,
  cs INTEGER NOT NULL,
  level INTEGER NOT NULL,
  PRIMARY KEY (patch, team_position, champion_id, minute)
) WITHOUT ROWID;
