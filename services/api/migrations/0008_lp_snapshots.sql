-- Riot keeps no LP history, so Vizier records a player's standing each time
-- their profile is fetched and it changed since the last record.
CREATE TABLE lp_snapshots (
  puuid TEXT NOT NULL,
  queue TEXT NOT NULL,
  tier TEXT NOT NULL,
  rank TEXT NOT NULL,
  lp INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  at INTEGER NOT NULL
);

CREATE INDEX lp_snapshots_by_player ON lp_snapshots (puuid, queue, at);
