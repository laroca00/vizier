-- Other queues join ranked solo: ARAM (450), Arena (1700) and URF (900, 1900).
-- Every existing row is ranked solo.
ALTER TABLE participant_stats ADD COLUMN queue_id INTEGER NOT NULL DEFAULT 420;
-- Teammates share a team_id, for synergies.
ALTER TABLE participant_stats ADD COLUMN team_id INTEGER;
-- Arena augment ids, "1,4,17,30". Collected now; shown only once Riot approves.
ALTER TABLE participant_stats ADD COLUMN augments TEXT;
-- Banned champion ids, "238,157,...", kept on the match row so bans add no rows.
ALTER TABLE crawled_matches ADD COLUMN bans TEXT;
ALTER TABLE crawled_matches ADD COLUMN queue_id INTEGER NOT NULL DEFAULT 420;

CREATE INDEX participant_stats_by_queue ON participant_stats (patch, queue_id, champion_id, team_position);
