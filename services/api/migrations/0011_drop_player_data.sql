-- Player profiles, match detail, LP history and the post-game coach are gone
-- from Vizier, so their tables go too. This deletes the stored match
-- documents, coach results and LP snapshots for good: export the database
-- first (see docs/IMPLEMENTATION_ROADMAP.md, phase 1).
DROP TABLE IF EXISTS match_participants;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS lp_snapshots;

-- Cached answers of the removed routes and the coach's counters.
DELETE FROM cache WHERE key NOT LIKE 'pro-%';

-- Published docs nothing serves any more.
DELETE FROM stat_docs WHERE key LIKE 'bench:%' OR key LIKE 'pace:%' OR key LIKE 'augments:%' OR key = 'mayhem-augments';
