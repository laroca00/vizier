-- One compact summary of each ranked champion and role build per closed patch,
-- written once when the next patch has taken over. The crawler publishes them
-- as stat_docs (buildhistory:<champion>:<position>); the Worker never reads
-- this table, so it needs no remote migration.
CREATE TABLE build_snapshots (
  patch TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  team_position TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (patch, champion_id, team_position)
) WITHOUT ROWID;
