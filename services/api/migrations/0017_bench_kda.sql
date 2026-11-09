-- Cumulative kills, deaths, assists and team kills at the end of each of the
-- first 15 minutes, "k.d.a.t,k.d.a.t,...", from the timeline when the
-- crawler fetched one. Feeds the kill participation and KDA benchmark.
ALTER TABLE participant_stats ADD COLUMN kda_minutes TEXT;

-- Sums over the ranked games that carried this series; `kda_games` can be
-- lower than `games` because rows written before this column have none.
ALTER TABLE bench_sums ADD COLUMN kda_games INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bench_sums ADD COLUMN kills INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bench_sums ADD COLUMN deaths INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bench_sums ADD COLUMN assists INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bench_sums ADD COLUMN team_kills INTEGER NOT NULL DEFAULT 0;
