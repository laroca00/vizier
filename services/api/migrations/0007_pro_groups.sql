-- Pros come in groups the app filters by: Worlds players and Turkish players.
ALTER TABLE pro_accounts ADD COLUMN grp TEXT NOT NULL DEFAULT 'worlds';
ALTER TABLE pro_matches ADD COLUMN grp TEXT NOT NULL DEFAULT 'worlds';
