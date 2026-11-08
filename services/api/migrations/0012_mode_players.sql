-- Players met in ARAM, ARAM Mayhem and Arena games. Ranked players rarely
-- play Arena or Mayhem, so the crawler follows the people who do.
CREATE TABLE mode_players (
  puuid TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  queue_id INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  last_crawled_at INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX mode_players_due ON mode_players (region, last_crawled_at);
