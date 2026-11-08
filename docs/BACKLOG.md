# Backlog

The work after `IMPLEMENTATION_ROADMAP.md` (phases 0–11 are done). Tasks are ordered inside each track; tracks can run in parallel, but take them roughly top to bottom. Product scope is unchanged: prepare, explore, customize. No post-game analysis, coaching or performance tracking, and no overlay redesign (the owner designs that).

## How to work through this file

- Pick the first unchecked task whose dependencies are checked. Mark it `[x]` with the merge commit hash when it lands, e.g. `- [x] B3 ... (a1b2c3d)`.
- A task that is too big gets split in place: add `B3a`, `B3b` under it and do the first slice.
- A task that can't be done (missing data, needs a live client, a decision from the owner) gets `[-]` and one line saying why. Move on.
- Every task ends with `pnpm --filter @vizier/desktop test`, `pnpm --filter @vizier/desktop lint` and `pnpm build:web` passing. API and crawler tasks also run `pnpm --filter @vizier/api test`.
- New logic gets Vitest tests. New Turkish strings get an English entry in `i18n.en.ts`.
- Anything that needs a Worker deploy, a D1 migration on the remote database or a VM restart is written so it is backward compatible, and the deploy step is added to "Owner deploy queue" at the bottom instead of being run.

---

## A. Foundations and code health

- [ ] A1 Split `App.css` per page. Move every rule into the CSS file next to the component that uses it; delete rules nothing uses. Acceptance: `App.css` holds only shell-wide rules, the bundle CSS size is equal or smaller, every page looks the same.
- [ ] A2 Fix the remaining ESLint hook-dependency warnings one file at a time, without changing behaviour. Where a dependency is left out on purpose, add a one-line comment saying why and a scoped disable.
- [x] A3 Typed fetch layer: give `api.ts` a single `request<T>()` with timeout, abort signal and one retry on network errors (not on 4xx). Tests for timeout, abort and retry using a fake `fetch`. (5daaa8a)
- [ ] A4 In-memory and `sessionStorage` cache for API answers with a per-route TTL (tier lists 30 min, builds 30 min, pro builds 5 min). Tests for expiry and key building.
- [ ] A5 `useAsync`: add stale-while-revalidate (show cached data, refresh in background) and cancel on unmount. Tests.
- [ ] A6 Data Dragon loader (`data/ddragon.ts`): cache static JSON per version in IndexedDB so a restart doesn't refetch `championFull.json`. Fallback to network when IndexedDB is missing. Tests with fake-indexeddb or an injected store.
- [ ] A7 Versioned local storage: one `migrate()` per store (`settings`, `personal`, `library`, `drafts`, `quiz`) with a schema version number and tests that load every older shape.
- [ ] A8 Export/import of local data: validate the file before writing anything, show what will be replaced (counts per store), keep a one-step undo of the last import.
- [ ] A9 Error reporting to the user: one place that turns `ApiError`, network failures and LCU failures into a short message plus a retry action. Replace ad-hoc messages page by page.
- [ ] A10 Remove dead exports and unused files (`ts-prune` style search by hand or with a small script under `apps/desktop/scripts/`). Delete only what has no imports.
- [ ] A11 Bundle report: add a `pnpm --filter @vizier/desktop analyze` script (rollup-plugin-visualizer as a dev dependency) and write the current per-chunk sizes into this file under "Numbers".
- [ ] A12 Lazy-load Data Dragon champion text (lore, tips) only on the champion page; the list pages need names and images only.
- [ ] A13 Strict TypeScript flags one at a time: `noUncheckedIndexedAccess` in `src/draft`, `src/library`, `src/patches` first. Fix the errors it raises.
- [ ] A14 Shared constants: positions, queue ids and role labels live in one module (`queues.ts`/`labels.ts`); remove duplicates across pages.
- [ ] A15 API tests: cover every route in `app.ts` with the node:sqlite stand-in, including bad input (unknown position, non-numeric champion id, unknown queue).
- [ ] A16 Crawler tests: rollup of a fixture match into `stat_counts` for every queue the crawler follows (ranked, ARAM, Mayhem, Arena), checked against hand-counted values.
- [ ] A17 `packages/shared`: create the workspace package with the types both sides use (`Build`, `TierEntry`, `BuildIndexEntry`, `ProBuild`, `docKey`). Switch `services/api` and `apps/desktop` to import them. No behaviour change.

## B. Tier list

- [ ] B1 Tier from a score that weighs win rate by sample size (Wilson lower bound or Bayesian shrink toward the role average), so a 536-game champion can't be S on win rate alone. Change in `services/api/src/stats.ts`, tests with fixed counts. Old clients keep working (same fields).
- [ ] B2 Minimum games threshold per role scaled to the role's total games (e.g. 0.5% of role games), so low-pick off-role rows show with a "low sample" mark instead of being dropped.
- [ ] B3 Win rate change versus the previous patch (`winRateChange` is always null now): fill it in the crawler when both patches have enough games.
- [ ] B4 Tier list UI: show win rate change with an arrow and colour, sortable.
- [ ] B5 Tier list UI: "low sample" badge and a toggle to hide those rows.
- [ ] B6 Tier list UI: column sorting for every numeric column, kept in the route state.
- [ ] B7 Tier list UI: search box filtering by champion name (Turkish and English names both match).
- [ ] B8 Tier list UI: pool filter — show only champions in my pool / my favourites.
- [ ] B9 Tier list UI: compact and comfortable density, saved in settings.
- [ ] B10 Tier list for ARAM, Mayhem and Arena with the same component, queue picker in the toolbar (the API already accepts `queue`).
- [ ] B11 Tier list explainer: a small "how tiers are made" popover with the actual rule and the game count.
- [ ] B12 Copy tier list as text (role, tier, champion, WR, games) for sharing in chat.

## C. Champion pages

- [ ] C1 Ability panel: cooldowns, costs and ranges per rank in a small table from `championFull.json`, with placeholders resolved where Data Dragon gives the values and an honest "–" where not.
- [ ] C2 Skill order visual: first-three levels and max order, plus the full 18-level grid already in `SkillGrid`, and how often that order is played.
- [ ] C3 Rune page visual: full tree layout (both trees and shards) with the chosen runes lit, others dimmed, and the pick rate of each chosen rune.
- [ ] C4 Item build path: starting items → first back → core 3 → situational, each with games and win rate, laid out as a timeline.
- [ ] C5 Boots comparison: each boots option with pick rate and win rate.
- [ ] C6 Summoner spells comparison table.
- [ ] C7 Counters tab: best and worst lane matchups with game counts, sortable, with a minimum games slider.
- [ ] C8 Synergies tab: best duo partners by role (bot + support, jungle + mid) from `/synergies`.
- [ ] C9 Matchup page: two champions side by side — base stats difference at levels 1, 6, 11, 18 computed from Data Dragon per-level stats, the matchup win rate, and the items bought more often in that matchup.
- [ ] C10 Base stats calculator: level slider 1–18 showing HP, AD, armor, MR, attack speed, with the per-level growth formula Riot uses. Tests against known values.
- [ ] C11 Champion page share: copy a link-free text summary (runes, items, skill order) for chat.
- [ ] C12 Skins gallery from CommunityDragon with chromas count, lazy-loaded.
- [ ] C13 Champion page for every queue: ARAM/Mayhem/Arena builds where the docs exist, queue picker in the header.
- [ ] C14 "Similar champions" list: same class and damage type, closest base stats; links to their pages.
- [ ] C15 Recently viewed champions list on Home gets the role that was open.
- [ ] C16 Personal note editor on the champion page: markdown-free plain text, autosave with a debounce, character count.
- [ ] C17 Per-matchup notes list on the champion page (`matchupNoteKey`), with jump to that matchup.

## D. Builds and Build Library

- [ ] D1 Build comparison 2.0: most popular vs highest win rate (with a minimum games bar) vs "against AP / AD / tank teams" side by side, every number with its game count.
- [ ] D2 Situational items: for each core item slot, the alternatives with how often they replace it and their win rate.
- [ ] D3 Item explorer page: every item with stats, cost, build path and the champions that buy it most (from the build index).
- [ ] D4 Item explorer: filters by stat (AP, AD, armor, MR, haste, crit), price range, map.
- [ ] D5 Item gold efficiency: gold value of stats per item using base-item stat prices, with a short explanation. Tests against hand-computed values.
- [ ] D6 Build editor: drag to reorder items, item search with stat filters, duplicate warning.
- [ ] D7 Rune editor: validation (one keystone, valid shard rows), and "copy from recommended" button.
- [ ] D8 Build library: tags (free text) besides collections, filter by tag.
- [ ] D9 Build library: sort by last edited, champion name, collection.
- [ ] D10 Share codes v2: shorter codes (base64url of a compact binary), still able to read v1 codes. Tests both ways.
- [ ] D11 Import a build from a share code pasted anywhere in the app (global paste detection with a toast "Build code found — open?").
- [ ] D12 Build diff: compare two saved builds and show added/removed items and runes.
- [ ] D13 Build library: bulk export/import of a collection as a file.
- [ ] D14 Build index search: search by item name ("champions that build Rabadon") and by keystone name.
- [ ] D15 Build gold timeline: when each core item is usually finished (needs crawler support; see F5).

## E. Champion select

- [ ] E1 Draft logic tests: cover `autoView`, opponent guessing and pick suggestion scoring with recorded champ select sessions (fixtures under `src/draft/fixtures/`).
- [ ] E2 Dev mock: a champ select session player under `src/dev/` that replays a fixture step by step, so champ select can be worked on without a client (`?view=champselect&mock=1`).
- [ ] E3 Team stats: for each ally pick, the champion's win rate in that role and its game count, from data already fetched.
- [ ] E4 AP/AD/true damage split bar for both teams, from a per-champion damage profile table in `data/traits.ts`.
- [ ] E5 Composition: engage, disengage, peel and waveclear dimensions added to `compDimensions`, with who brings each. Extend `traits.ts` and its tests.
- [ ] E6 Composition: game phase strength (early / mid / late) from a hand-kept per-champion curve in `traits.ts`, shown as three bars per team.
- [ ] E7 Composition: weaknesses list ("no frontline", "all AD", "no waveclear") with one-line advice each.
- [ ] E8 Ban suggestions in champ select from `/v1/bans`, filtered to the player's role opponents and their pool-relevant counters.
- [ ] E9 Pick suggestions: "from my pool first" toggle.
- [ ] E10 Pick suggestions: explain each suggestion's score breakdown in a tooltip.
- [ ] E11 Matchup guide: power spike levels for both champions (level 2/3/6 from ability data, item spikes from the build).
- [ ] E12 Matchup guide: "what to watch" — the opponent's key abilities with cooldowns at rank 1 and at max.
- [ ] E13 Duo synergy hint in champ select for bot lane and jungle–mid using `/synergies`.
- [ ] E14 Champ select layout check at 1280×720 and 1024×640 in the real window (needs a person; mark `[-]` if no window is available).

## F. API and crawler

- [ ] F1 Ban rate is a bit lower than other sites; check how bans are counted (per game vs per team, duplicates) and fix with tests.
- [ ] F2 Seed: add more Diamond and Emerald pages so the pool isn't apex-heavy; keep within the 70% key share. Config in one place.
- [ ] F3 Region and tier columns in `stat_counts` (new migration, backward compatible) so tier lists can later be split by region and rank.
- [ ] F4 Tier list by rank band (Emerald, Diamond, Master+) using F3, behind a query parameter; old clients get the pooled list.
- [ ] F5 Item completion times: record the minute each finished item is bought (from timelines) and roll it up per champion build.
- [ ] F6 Skill order win rates: roll up first-three and max-order variants with their win rate.
- [ ] F7 Rune pick rates per slot so the rune page can show per-rune pick rates (C3).
- [ ] F8 Matchup builds: lower the game threshold for popular matchups using a shrink toward the overall build.
- [ ] F9 Publish only docs whose content hash changed (check it's already the case and add a test); log D1 writes per publish.
- [ ] F10 `/health` returns the newest `stat_docs.updated_at` and total games so freshness can be checked from outside.
- [ ] F11 API: `ETag`/`If-None-Match` on doc routes so the desktop can revalidate cheaply.
- [ ] F12 Crawler metrics line every hour: games saved per host, requests used, 429 count.
- [ ] F13 Crawler: drop games shorter than the remake threshold and with early surrender from every rollup (check and test).
- [ ] F14 Pro builds: add LCK, LPL, LEC, LCS team lists to `proPlayers.ts` where the players' accounts are public, with tests for name matching.

## G. Pro builds

- [ ] G1 Pro player pages: a player's recent games, most played champions and their usual runes.
- [ ] G2 Follow a pro: followed players' newest games on Home.
- [ ] G3 Pro games by champion on the champion page, with "same opponent" first (reuse the champ select logic).
- [ ] G4 Pro build to library: save any pro game build as a personal build in one click (exists for some views; make it everywhere).
- [ ] G5 Pro filters in the route state so back/forward keeps them.
- [ ] G6 Pro builds empty states per filter combination with a "clear this filter" action.

## H. Draft simulator

- [ ] H1 Simulator: import the current champ select as a draft (when the client is running).
- [ ] H2 Simulator: export a draft as text and as a share code; import from a code.
- [ ] H3 Simulator: undo/redo for picks, bans and swaps.
- [ ] H4 Simulator: role assignment check — warn when a pick is far from its usual roles.
- [ ] H5 Simulator: show both teams' AP/AD split and phase curves (E4, E6).
- [ ] H6 Simulator: keyboard flow — type to search, Enter to pick into the selected slot, Tab to the next slot.
- [ ] H7 Simulator: pro draft presets (recent pro games' drafts loaded as read-only examples).

## I. Patch tracker

- [ ] I1 Patch diff: per-level stat changes shown as "at level 1 / at level 18" values, not only the raw growth number.
- [ ] I2 Patch diff: ability cooldown and cost changes per rank where Data Dragon has them.
- [ ] I3 Patch diff: item build path and recipe cost changes.
- [ ] I4 Patch diff: champions in my pool first, with a badge on Home when one of them changed.
- [ ] I5 Patch diff: buff/nerf label per change from a simple rule (higher base stat = buff, longer cooldown = nerf), with "mixed" when both.
- [ ] I6 Patch history: a champion's changes over the last N cached versions on its page.
- [ ] I7 Patch tracker: win rate before/after the patch for changed champions, from B3 data.

## J. Home and navigation

- [ ] J1 Home: "for your pool this patch" card — each pool champion's tier, win rate change, and whether it was changed in the patch.
- [ ] J2 Home: quick search field that opens the search palette.
- [ ] J3 Home: customise which cards show and their order (saved in settings).
- [ ] J4 Search palette: items, runes, pro players and saved builds as result types.
- [ ] J5 Search palette: recent searches and keyboard hints.
- [ ] J6 Keyboard shortcut help modal (`?`) listing every shortcut in the app.
- [ ] J7 Breadcrumbs for detail pages (Champions › Ahri › Matchup vs Zed).
- [ ] J8 Deep links: `vizier://champion/103?role=MIDDLE` handled by Tauri and the router (Rust side with tests; frontend parsing with tests).

## K. Quiz and fun

- [ ] K1 Riddle: ability-icon mode with rotation/greyscale difficulty steps.
- [ ] K2 Riddle: quote mode from CommunityDragon champion voice-line text where available.
- [ ] K3 Riddle: item recipe mode ("which item is built from these?").
- [ ] K4 Riddle: statistics page — streaks, guess distribution chart, per-mode history.
- [ ] K5 Riddle: hard mode settings per mode (fewer hints).
- [ ] K6 Item game: timed mode and a local best score.

## L. Settings, i18n and accessibility

- [ ] L1 Full English pass: every page in English with no Turkish left, checked by a test that renders keys through `t()` for every page's key list.
- [ ] L2 Third language scaffold (e.g. German) behind a setting, with fallback to English, so translations can be added later. Test that missing keys fall back.
- [ ] L3 Number and percent formatting per language (`Intl.NumberFormat`), one helper used everywhere.
- [ ] L4 Focus order pass on every page; visible focus rings using the existing token.
- [ ] L5 Contrast check of every text/background token pair (script that reads `styles.css` and reports WCAG ratios); fix failures.
- [ ] L6 Reduced motion: every animation respects `prefers-reduced-motion` and the app's own setting.
- [ ] L7 Screen reader labels for icon-only buttons (champion, item and rune icons get names).
- [ ] L8 Settings search: filter settings by text.
- [ ] L9 Font size setting (90 / 100 / 110 %) applied through a root variable.

## M. Performance

- [ ] M1 Virtualised lists for the champion list, item explorer and build library when they pass 100 rows.
- [ ] M2 Image loading: `loading="lazy"`, explicit sizes and a shared image cache for champion/item/rune icons.
- [ ] M3 Measure memory of the main window after visiting every page; write numbers here and fix any page that holds large data after leaving it.
- [ ] M4 Debounce every search input (150 ms) and move heavy filtering into `useDeferredValue`.
- [ ] M5 Startup: measure time to first paint and to Home ready; defer anything not needed for Home.

## N. Documentation

- [ ] N1 README: current feature list, screenshots placeholders, how to build, how data is collected.
- [ ] N2 `docs/ARCHITECTURE.md`: data flow crawler → D1 → Worker → desktop, the doc keys, caching layers.
- [ ] N3 `services/api/README.md`: routes with example responses.
- [ ] N4 Contributor notes for adding a translation and a new page.

---

## Numbers

(filled in by A11, M3, M5)

## Owner deploy queue

Steps that need the owner's credentials or approval. Add to this list; don't run them.

- Release a desktop version (`pnpm release`) after bumping the patch version.
- Deploy the Worker (`pnpm --filter @vizier/api deploy`).
- Apply pending D1 migrations remotely.
- Pull and restart the crawler on the VM.
