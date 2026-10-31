-- Per-player numbers for Emerald+ benchmarks, from the match document's
-- challenges block, so they cost no extra Riot calls.
ALTER TABLE participant_stats ADD COLUMN opponent_champion_id INTEGER;
ALTER TABLE participant_stats ADD COLUMN duration INTEGER;
ALTER TABLE participant_stats ADD COLUMN deaths INTEGER;
ALTER TABLE participant_stats ADD COLUMN cs10 INTEGER;
ALTER TABLE participant_stats ADD COLUMN cs_pm REAL;
ALTER TABLE participant_stats ADD COLUMN gold_pm REAL;
ALTER TABLE participant_stats ADD COLUMN vision_pm REAL;
ALTER TABLE participant_stats ADD COLUMN kill_participation REAL;
ALTER TABLE participant_stats ADD COLUMN damage_share REAL;

-- From the timeline, which only some crawled games fetch: item ids bought in
-- the first minute, the skill slot (1-4) of each level-up, and the order of
-- every purchase net of undos.
ALTER TABLE participant_stats ADD COLUMN start_items TEXT;
ALTER TABLE participant_stats ADD COLUMN skill_order TEXT;
ALTER TABLE participant_stats ADD COLUMN purchase_order TEXT;

CREATE INDEX participant_stats_by_position ON participant_stats (patch, team_position);
CREATE INDEX participant_stats_by_matchup ON participant_stats (patch, champion_id, opponent_champion_id);
