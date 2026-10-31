-- Match documents never change once a game is over, so they are stored once.
CREATE TABLE matches (
  match_id TEXT PRIMARY KEY,
  patch TEXT NOT NULL,
  queue_id INTEGER NOT NULL,
  game_start INTEGER NOT NULL,
  data TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- One row per player per match: the base for win rates and builds later.
CREATE TABLE match_participants (
  match_id TEXT NOT NULL REFERENCES matches (match_id),
  puuid TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  team_position TEXT NOT NULL,
  win INTEGER NOT NULL,
  PRIMARY KEY (match_id, puuid)
);

CREATE INDEX match_participants_by_puuid ON match_participants (puuid);
CREATE INDEX match_participants_by_champion ON match_participants (champion_id, team_position);

-- Short-lived API responses: accounts, ranks, match id lists.
CREATE TABLE cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
