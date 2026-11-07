# Product audit

Snapshot of the repository on 2026-11-07, at commit `425eba6`, taken before the move to the "prepare, explore, customize" product. Everything below comes from reading the source, not the README.

## 1. Current architecture

### Desktop app (`apps/desktop`)

- Tauri 2 with React 19 and TypeScript, built by Vite 8. Styling is plain CSS with no CSS framework. Design tokens live in `src/styles.css`: the Iznik palette, flat surface tokens and motion tokens.
- There is no router. `App.tsx` keeps a `view` state (`home`, `queue`, `draft`, `tiers`, `pros`, `champion`, `profile`, `settings`, `about`) and renders one page at a time. `Sidebar.tsx` and the top bar in `App.tsx` form the shell.
- The main window has no system frame. `WindowControls.tsx` draws the traffic lights, and the top bar and the menu strip are drag regions.
- One bundle serves two windows. `main.tsx` renders `Overlay` when the window label is `overlay`.
- Settings are stored in `localStorage` under `vizier.settings` (`settings.ts`) and shared with the overlay window through the `storage` event. Personal data (champion pool, notes, goals) is stored under `vizier.personal` (`personal.ts`).
- Localisation: Turkish strings in the code are their own keys, and English comes from `i18n.en.ts` (about 580 entries). The language follows the League client's locale, and the user can override it in Settings.
- Static game data comes from Data Dragon (`data/ddragon.ts`): champions, items, runes, spells, skins and champion details. `data/traits.ts` derives composition traits from Data Dragon tags and info.
- Updates go through `tauri-plugin-updater` against the Worker's `UPDATES` KV (`scripts/release.mjs`).

### Rust side (`apps/desktop/src-tauri`)

- `lcu/` reads LCU credentials from the lockfile or the process command line, opens the client's WebSocket for gameflow and champ select events, and parses champ select. Local identities are dropped there. `lcu/writes.rs` imports rune pages, summoner spells and item sets. It reuses the Vizier rune page, never replaces a preset page and asks before touching the player's own pages.
- `live.rs` polls the Live Client Data API during games and creates the overlay window only while a game runs. It also handles hide (Ctrl+Shift+O), edit mode (Ctrl+Shift+L), the scoreboard on Tab and the manual timer shortcuts.
- `lib.rs` manages the tray and close-to-tray, sets the WebView2 memory target (low while hidden, minimised or behind the game) and handles autostart with `--minimized`.

### API (`services/api`)

- Hono on Cloudflare Workers (free plan), with D1 for data, Workers AI for the free coach wording, KV for updates and a daily cron at 04:00 UTC.
- Stats are not computed in the Worker. It serves `stat_docs` rows that `services/crawler` publishes.
- Live Riot calls (profiles, match lists, spectator, LP) go through the Worker with the key as a secret, rate limited per routing value and cached in the D1 `cache` table.

### Crawler (`services/crawler`)

- A Node 24 process on an Oracle Cloud Always Free VM. It runs the API's own crawler code over a local SQLite file.
- It crawls TR and EUW Emerald+ on the Europe host and KR Challenger on the Asia host. It also crawls pro and Challenger accounts for the Pro Builds page.
- It rolls raw rows into `stat_counts`. Tier lists, pick rates and ban rates read only the TR and EUW `pool` counts; builds and matchups read every game. Changed docs are published to D1 every 4 hours, and pro games every 10 minutes.

### D1 tables

| Table | Used by |
|---|---|
| `matches`, `match_participants` | Stored match documents for profiles, match detail, reports and the coach |
| `cache` | Short-lived cache: live Riot answers (profiles, spectator, match lists) and pro builds and teams |
| `lp_snapshots` | LP history for the dashboard |
| `crawl_players`, `crawled_matches`, `participant_stats`, `crawl_state` | Crawler state and raw rows. The crawler keeps its own copies in SQLite; the Worker's daily cron still prunes the D1 copies |
| `stat_counts`, `stat_matches` | Rolled-up counts (crawler SQLite) |
| `stat_docs` | Published stats the Worker serves |
| `pro_accounts`, `pro_matches` | Pro Builds |

## 2. Features by surface

| Surface | What it does today | Status |
|---|---|---|
| Home, connected | Player dashboard: rank and LP chart, form, today and this week, roles, goals, champion pool stats, last 20 games, tilt warning, my pool, pro builds, lane meta picks | Implemented |
| Home, not connected | Wordmark, client status, lane meta picks, latest pro builds | Implemented |
| Queue screen | Rank, session, goals and guides for the pool while matchmaking | Implemented |
| Champ select | My pick, build suggestion (runes, spells, starting, core and situational items, skill order, build styles, comparison), automatic and manual imports, team composition, enemy tips, lane matchups, ally win rates, my record on the champion, pool strip, notes, pro builds, ban suggestions | Implemented |
| Champion page | Overview with tier, win, pick and ban rates and role share, builds, counters, synergies, abilities, strengths and weaknesses, matchup notes, personal notes, pro builds | Implemented |
| Tier list | Ranked by role, ARAM, Arena and URF; win and pick rate map, table with ban rate, ban suggestions | Implemented |
| Pros | Pro and Challenger builds with team and region filters | Implemented |
| Profile search | Riot ID lookup with a dashboard, match detail, report card, gold graph and coach | Implemented |
| Post-game | Opens the coach after a game when the setting is on; rules plus Gemma wording, optional Claude | Implemented |
| Overlay | Skill to level next, objective timers, Emerald+ benchmarks, pace, item gold difference, scoreboard item difference, next item, coach goal, manual timers, loading screen scouting; draggable layout | Implemented |
| Search palette | Champions and Riot IDs (Ctrl+K) | Implemented |
| Settings | Import toggles, show on champ select, post-game analysis, queue screen, tilt warnings, overlay widgets, timer sound and length, language, autostart | Implemented |
| Champion database | Only reachable per champion through search or the tier list; no list page | Partial |
| Champion pool | Local list in `personal.ts`; shown in champ select and on the dashboard, mixed with performance stats | Partial |
| Personal notes | Per champion and per matchup (`Journal.tsx`) | Implemented |
| Build library, saved builds | None | Missing |
| Draft simulator | None (`CompAnalysis` runs only in a real champ select) | Missing |
| Patch tracker | None | Missing |
| Arena and Mayhem augment win rates | Computed and published to `stat_docs`. The endpoints return 403 unless the `ARENA_AUGMENTS` or `MAYHEM_AUGMENTS` flag is set, and both returned 403 live on 2026-11-07. No UI shows them | Backend only, switched off |

There are no placeholder buttons. Every visible control has an action.

## 3. Technical problems

- No frontend tests, no linter and no CI. Only `services/api` (vitest, 78 tests), `services/crawler` (3 tests) and the Rust unit tests exist.
- Navigation is a `view` string in `App.tsx` with page-specific state such as `champion` and `riotId`. With nine sections and detail pages this needs a small router or a typed route state.
- `App.css` holds about 2,300 lines, many of them for removed layouts. `dashboard.css` is about 1,000 lines and goes away with the dashboard.
- Pages still wrap themselves in `LiquidGlass`, which now renders flat through `FlatGlass`. A plain surface component would be simpler.
- Tier lists combine the two newest patches, but the subtitle names only the newest one.
- `stat_counts` keeps no region or tier, so pool filtering relies on the match id prefix.
- Fixtures (`dev/fixtures.ts`) are imported by production modules. They are guarded by `import.meta.env.DEV`, so it is safe, but the imports are noisy.
- `features.md` in the repository root is untracked; it is the owner's notes.

## 4. Reusable as is

- The LCU integration in Rust: credentials, events, champ select parsing and all three importers with their safety rules.
- Overlay window management in `live.rs`: created only in game, hide and edit shortcuts, always on top.
- `data/ddragon.ts`, `data/traits.ts`, `labels.ts`, `queues.ts`, `useAsync.ts` and `i18n.ts`.
- `BuildSuggestion`, `BuildCompare`, `SkillGrid`, `buildStyles.ts`, `ChampionGuide`, `CompAnalysis` and `ProBuildList`.
- The shell (`Sidebar.tsx`, `WindowControls.tsx`, `shell.css`), `SearchPalette` (champion part), `UpdateNotice`, `charts.tsx` (`Scatter`, `SegmentBar`) and `ui/Splash.tsx`.
- Crawler, rollup, stats and `stat_docs` for builds, tiers, counters, synergies and pro builds.

## 5. To refactor

- `App.tsx`: route state for the new sections and detail pages.
- `ChampSelectPage.tsx`: drop the personal record parts, add confirmed imports and a clearer layout.
- `ChampionPage.tsx`: split into the Champions database detail and Build Library detail pieces.
- `personal.ts`: keep pool and notes, drop goals, add saved builds, collections, drafts and favourites with a versioned schema.
- `SearchPalette.tsx`: champions, builds and sections only.
- `SettingsPage.tsx`: regroup into General, League client, Overlay, Personalisation, and Data and privacy.
- `overlay/Overlay.tsx`: keep the window logic and layout editor, and rebuild the widget set.
- `App.css`: split per page and remove dead rules.

## 6. To remove (owner's decision, 2026-11-07)

Post-game analysis, the coach, player profiles, the dashboard, scouting and the performance overlay widgets go. Backend code and data go with them.

Desktop:

- `CoachPanel.tsx`, `MatchDetail.tsx`, `ReportCard.tsx`, `GoldChart.tsx`, `ProfileCard.tsx`, `ProfileExtras.tsx`, `Dashboard.tsx`, `dashboard.css`, `pages/ProfilePage.tsx`, `pages/QueuePage.tsx`, `games.ts`, `overlay/Scouting.tsx`
- From `ChampSelectPage.tsx`: `MyRecord` and the game log fetch. `PoolStrip` stays but reads only the local pool.
- From `Overlay.tsx`: benchmarks, pace, item gold difference, scoreboard rows, coach goal and scouting.
- From `charts.tsx`: `GameBars`, `TrendLine` and `HBars`, once nothing uses them.
- From `personal.ts`: goals.
- From `api.ts`: `getProfile`, `getRecentMatches`, `getCoaching`, `getBenchmarks`, `getPace`, `getLiveGame`, `getReport`, `getChampionPool`, `getLpHistory`, `getTrends`, `getGoldGraph`, `getMatch` and `getGameLog`.
- Settings: `openAnalysisAfterGame`, `tiltWarnings`, `queueCompanion` and `overlayBenchmarks`, `overlayPace`, `overlayItems`, `overlayScoreboard`, `overlayGoal`, `overlayScouting`.
- Translations used only by the above.

API:

- Routes: `/v1/profiles/*`, `/v1/live/:puuid`, `/v1/players/:puuid/*`, `/v1/matches/*`, `/v1/coach/:matchId`, `/v1/benchmarks/*`, `/v1/pace/*`
- Modules: `coach.ts`, `coachRules.ts`, `coachRewrite.ts`, `report.ts`, `trends.ts`, `profileStats.ts` and the parts of `store.ts` that only serve them, with their tests.
- `benchmarks` and `pace` in `stats.ts` and `statDocs.ts`, and the raw columns that only feed them, if nothing else reads them.
- The `ai` binding, the `ANTHROPIC_API_KEY` and `COACH_PUUIDS` secrets and the coach rate limits.
- D1: `matches`, `match_participants` and `lp_snapshots`. Dropping them deletes stored coach history and LP data for good. `cache` stays because Pro Builds uses it; only the dropped routes' keys go.

## 7. Missing infrastructure

- A route model for nine sections and their detail pages.
- Reusable components: button variants, tabs, dropdown, modal and confirm dialog, toast, tooltip, empty, loading and error states, and champion, item and rune cards.
- A versioned local store for user data (builds, collections, drafts, pool, notes, favourites, overlay layout), with export and import.
- Patch data: diffing Data Dragon versions for champion, item and rune values. Riot's patch notes have no API, so the app links to them instead of parsing them.
- Frontend tests (vitest and Testing Library for logic and key components), a linter and CI.
- An error boundary around each page.

## 8. API and data dependencies

| Data | Source | Retained features |
|---|---|---|
| Builds, tiers, counters, synergies, bans | Crawler, through `stat_docs` | Champ select, Build Library, Champions, tier list |
| Pro builds | Crawler, `pro_matches` | Pro Builds |
| Champions, items, runes, spells, abilities, skins | Data Dragon (CDN) | Everywhere |
| Champ select, imports, gameflow | LCU | Champ select, imports, overlay show and hide |
| In-game state | Live Client Data API | Overlay (reduced) |
| Patch notes | Riot website (linked, not parsed) | Patch Tracker |

## 9. Riot policy concerns

Covered in `docs/RIOT_POLICY_REVIEW.md`:

- The augment win rate endpoints exist but are switched off.
- Objective respawn timers and manual jungle timers need a policy check.
- The next-item and skill-order overlay widgets are borderline.
- Scouting goes away.
