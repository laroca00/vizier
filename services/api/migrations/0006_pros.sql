-- Pro players' solo queue accounts, resolved from proPlayers.ts once a day.
CREATE TABLE pro_accounts (
  puuid TEXT PRIMARY KEY,
  player TEXT NOT NULL,
  team TEXT NOT NULL,
  role TEXT NOT NULL,
  platform TEXT NOT NULL,
  riot_id TEXT NOT NULL,
  last_crawled_at INTEGER NOT NULL DEFAULT 0
);

-- One row per pro per game: only the pro's own build, kept like a match
-- history entry so it can be imported as is.
CREATE TABLE pro_matches (
  match_id TEXT NOT NULL,
  puuid TEXT NOT NULL,
  player TEXT NOT NULL,
  team TEXT NOT NULL,
  platform TEXT NOT NULL,
  patch TEXT NOT NULL,
  game_start INTEGER NOT NULL,
  duration INTEGER NOT NULL,
  champion_id INTEGER NOT NULL,
  opponent_champion_id INTEGER,
  team_position TEXT NOT NULL,
  win INTEGER NOT NULL,
  kills INTEGER NOT NULL,
  deaths INTEGER NOT NULL,
  assists INTEGER NOT NULL,
  cs INTEGER NOT NULL,
  gold INTEGER NOT NULL,
  runes TEXT NOT NULL,
  spells TEXT NOT NULL,
  items TEXT NOT NULL,
  start_items TEXT,
  skill_order TEXT,
  purchase_order TEXT,
  PRIMARY KEY (match_id, puuid)
);

CREATE INDEX pro_matches_recent ON pro_matches (game_start);
CREATE INDEX pro_matches_by_champion ON pro_matches (champion_id, game_start);
CREATE INDEX pro_accounts_due ON pro_accounts (last_crawled_at);
