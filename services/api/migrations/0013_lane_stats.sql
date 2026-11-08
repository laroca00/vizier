-- Gold at minutes 10 and 15 and first blood, from the timeline when the
-- crawler fetched one; they feed the lane difference sums below.
ALTER TABLE participant_stats ADD COLUMN gold10 INTEGER;
ALTER TABLE participant_stats ADD COLUMN gold15 INTEGER;
ALTER TABLE participant_stats ADD COLUMN first_blood INTEGER;

-- What a champion is ahead (or behind) by against its lane opponent, summed
-- over games where both players have timeline data. Divide by games for the
-- average. Rows for old patches are deleted with their counts.
CREATE TABLE lane_sums (
  patch TEXT NOT NULL,
  team_position TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  opponent_id INTEGER NOT NULL,
  games INTEGER NOT NULL,
  cs10 INTEGER NOT NULL,
  cs15 INTEGER NOT NULL,
  gold10 INTEGER NOT NULL,
  gold15 INTEGER NOT NULL,
  first_bloods INTEGER NOT NULL,
  PRIMARY KEY (patch, team_position, champion_id, opponent_id)
) WITHOUT ROWID;
