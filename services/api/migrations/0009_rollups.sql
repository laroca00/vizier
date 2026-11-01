-- Players now come from more than one region, and match-v5 must be asked on
-- the player's own. Existing players are all TR and EUW.
ALTER TABLE crawl_players ADD COLUMN region TEXT NOT NULL DEFAULT 'europe';
DROP INDEX crawl_players_due;
CREATE INDEX crawl_players_due ON crawl_players (region, last_crawled_at);

-- Builds, matchups and tiers read rolled-up counts now, so these raw indexes
-- only cost writes.
DROP INDEX participant_stats_by_matchup;
DROP INDEX participant_stats_by_queue;

-- Win and game counts rolled up from participant_stats, so raw rows can be
-- deleted after a few days. `kind` says what `value` holds:
--   games      ''                       every game on the champion
--   rune       rune key                 spell  "4,14"      item  item id
--   start      sorted starting items    core   first three finished items
--   skill      "maxorder|first three"   (these three only from games with a timeline)
--   opponent   lane opponent id         ally   "championId:position"
--   augment    augment id               augmented  ''  (games that had augments)
--   ban        ''  (champion_id is the banned champion)
--   vs-rune, vs-spell, ...              "opponentId|value", builds per matchup
CREATE TABLE stat_counts (
  patch TEXT NOT NULL,
  queue_id INTEGER NOT NULL,
  team_position TEXT NOT NULL,
  champion_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  games INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  PRIMARY KEY (patch, queue_id, team_position, champion_id, kind, value)
) WITHOUT ROWID;

CREATE INDEX stat_counts_by_champion ON stat_counts (champion_id, queue_id, kind);

-- Every crawled game per patch and queue, including skipped ones, so the
-- newest patches are known after the raw rows are gone.
CREATE TABLE stat_matches (
  patch TEXT NOT NULL,
  queue_id INTEGER NOT NULL,
  games INTEGER NOT NULL,
  last_start INTEGER NOT NULL,
  PRIMARY KEY (patch, queue_id)
) WITHOUT ROWID;

-- Finished answers the Worker serves as they are. services/crawler computes
-- them and writes them here; keys match the API's routes.
CREATE TABLE stat_docs (
  key TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
