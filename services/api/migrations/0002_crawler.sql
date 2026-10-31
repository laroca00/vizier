-- Emerald+ TR players whose ranked games feed the build stats.
CREATE TABLE crawl_players (
  puuid TEXT PRIMARY KEY,
  tier TEXT NOT NULL,
  last_crawled_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX crawl_players_due ON crawl_players (last_crawled_at);

-- Crawled games keep only what the stats need, not the match document:
-- a full document is ~60 KB and D1's free plan stores 5 GB.
CREATE TABLE crawled_matches (
  match_id TEXT PRIMARY KEY,
  patch TEXT NOT NULL,
  game_start INTEGER NOT NULL
);

CREATE INDEX crawled_matches_by_patch ON crawled_matches (patch, game_start);

CREATE TABLE participant_stats (
  match_id TEXT NOT NULL,
  patch TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  team_position TEXT NOT NULL,
  win INTEGER NOT NULL,
  -- "primary:sub:p1,p2,p3,p4:s1,s2:offense,flex,defense"
  runes TEXT NOT NULL,
  -- Summoner spell ids, sorted: "4,14"
  spells TEXT NOT NULL,
  -- Final inventory item ids without the trinket: "3157,3020,6655"
  items TEXT NOT NULL,
  PRIMARY KEY (match_id, champion_id)
);

CREATE INDEX participant_stats_by_champion ON participant_stats (patch, champion_id, team_position);

CREATE TABLE crawl_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
