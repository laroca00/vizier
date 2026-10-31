-- Total CS at the end of each of the first 15 minutes, "8,17,25,...", from
-- the timeline when the crawler fetched one. Feeds the in-game pace panel.
ALTER TABLE participant_stats ADD COLUMN cs_minutes TEXT;
