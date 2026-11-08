# Implementation roadmap

The plan for turning Vizier into a preparation and reference app: prepare, explore, customize. It builds on `PRODUCT_AUDIT.md` and `RIOT_POLICY_REVIEW.md`.

## Decisions already made (2026-11-07)

- Delete post-game analysis, the AI coach, player profiles and the dashboard completely: UI, Worker routes, modules and D1 tables.
- Remove scouting and the overlay widgets that need the deleted backend (benchmarks, pace, coach goal).
- Overlay 2.0 is out of this plan: the owner has their own design for it. The remaining overlay (timers, skill hint, next item, item gold, scoreboard) stays as it is until then.
- Keep the Iznik palette and the current shell (side menu, top bar, traffic lights). The brief's violet palette was not adopted.
- The language follows the League client, with a manual override. English is the fallback for keys without a translation.
- Keep the stack: Tauri 2, React, plain CSS, Hono on Workers, D1 and the crawler on the free VM. Add no paid infrastructure.
- Store user data locally (`localStorage`, versioned). There are no online accounts.

## Status

| Phase | Status |
|---|---|
| 0. Audit, policy review, roadmap | Done (this document) |
| 1. Removal and cleanup | Code done; deploy steps open (see below) |
| 2. Design system components | Done, except splitting `App.css` per page |
| 3. Navigation and Home | Done |
| 4. Champion Select 2.0 | Done; needs a check against a live client |
| 5. Build Library | Done; search needs the Worker deployed and the crawler restarted |
| 6. Champions and champion pool | Done |
| 7. Pro Builds | Done; server-side player, region and patch filters need the Worker deployed |
| 8. Draft Simulator | Done (owner asked for it on 2026-11-08) |
| 9. Patch Tracker | Done |
| 10. Overlay 2.0 | Owner's design, not in this plan |
| 11. Polish and release | Done except the release itself, which waits for the owner |

Every phase ends the same way: typecheck, the existing tests and new tests pass, `pnpm build:web` succeeds, the affected screens are checked at 1280×720 and 1920×1080, this table is updated, and the work goes in small commits.

## Phase 1: removal and cleanup

Done in code (commits `2dd73c6` to `d50312e`):
- The Worker no longer has player, match, coach, benchmark, pace or augment routes, and needs no Riot key.
- The crawler stops publishing those docs.
- The desktop app lost the dashboard, profiles, queue screen, coach, scouting and the overlay widgets that need the deleted routes.
- Unused translations and CSS are gone.
- The JavaScript bundle went from 439 KB to 372 KB, the CSS from 62 KB to 50 KB.

Still open, in this order:
1. Release a desktop version. Installed copies of 0.6.1 call the removed routes, so the new version should be out before the Worker is deployed.
2. Deploy the Worker (`pnpm --filter @vizier/api deploy`), then remove the secrets it no longer reads: `npx wrangler secret delete RIOT_API_KEY`, `ANTHROPIC_API_KEY` and `COACH_PUUIDS`.
3. Back up D1, then apply migration `0011_drop_player_data.sql` with `pnpm --filter @vizier/api db:migrate:remote`.
4. Pull and restart the crawler on the VM. It applies `0010` and `0011` to its own SQLite file on start.

The plan as written before the work:

Work: delete the items listed in `PRODUCT_AUDIT.md` section 6, in this order so nothing breaks halfway.

1. Desktop: remove the Profile page, the post-game flow and the Queue screen from `App.tsx`. Make Home a temporary page with meta picks and pro builds until Phase 3. Remove `MyRecord` and the game log fetch from champ select.
2. Overlay: drop benchmarks, pace, coach goal and scouting. The rest waits for the owner's overlay design; the policy review lists which widgets need Riot's answer first.
3. Remove the dead modules, `api.ts` functions, settings keys, translations and CSS.
4. API: remove the routes and modules, the `ai` binding, coach secrets and limits, the benchmark and pace docs, and the augment computation and endpoints. Deploy the Worker.
5. Crawler: stop computing benchmarks, pace and augment docs. Keep the raw columns until a later migration, so the crawler and an older Worker stay compatible during the switch.
6. D1: back up with `wrangler d1 export vizier --remote --output=backup-2026-11.sql`, then apply a migration that drops `matches`, `match_participants` and `lp_snapshots`. This step deletes data permanently.
7. Remove `@anthropic-ai/sdk` and any other dependency nothing uses any more.
8. Update the README, CLAUDE.md (layout and scope lines) and the policy review.

Dependencies: none.

Risks:
- `store.ts` serves both the deleted routes and the pro builds cache. Split it before deleting.
- Old desktop versions call deleted routes. They must fail gracefully, so ship a desktop release before or together with the Worker deploy.
- Settings saved by old versions keep unknown keys. `settings.ts` already merges onto defaults, so the leftovers are harmless.

Acceptance:
- No route, component, setting or translation for the removed features remains (search for `coach`, `trends`, `lp`, `profile`, `scouting`, `benchmark`, `pace`).
- Champ select imports still work against a real client.
- API, crawler and Rust tests pass, the Worker deploys, and the desktop production build succeeds.
- The backup file exists before the drop migration runs.

## Phase 2: design system components

Done (`60082f2`, `7c36ae8`): the components below exist in `src/ui` (BuildCard waits for Phase 5, which defines what a build card shows), the tier list, pro builds, champion page and build comparison use them, and `ui/ui.css` holds their styles. `App.css` is not split per page yet.

Work:
- Components in `src/ui/`: Button (primary, secondary, ghost, danger), IconButton, Tabs, Dropdown, SearchInput, FilterChips, Modal, ConfirmDialog, Toast, Tooltip, EmptyState, ErrorState, Skeleton, and Champion, Item, Rune and Build cards.
- A `Page` layout with header, toolbar and content, and an error boundary per page.
- Keep `LiquidGlass` for panels (owner's decision, 2026-11-07); it stays flat in the main window through `FlatGlass`. Split `App.css` per area and delete dead rules.
- Type scale tokens next to the colour and motion tokens in `styles.css`.

Dependencies: Phase 1, so no time goes into components that are about to be deleted.

Risks: restyling every page at once. Swap components page by page.

Acceptance:
- Every new component has keyboard focus, hover and disabled states and respects reduced motion.
- `App.css` keeps only rules that are in use.

## Phase 3: navigation and Home

Done (`fa4ff00`):
- Typed routes with history in `router.ts`, error boundaries, the new Home and an Overlay section split out of Settings.
- Settings has a data section to export, import and clear local data.
- The menu lists only sections that exist: Home, Champ select (live), Tier list, Pro builds, Overlay, Settings and About. Build Library, Champions and Patch Tracker join the menu in their own phases. The Draft Simulator waits for the design talk.
- The tier list stays as its own entry under Explore.

Work:
- Typed route state (section, detail id, filters) instead of the `view` string, with back and forward through mouse buttons and Alt+Left and Alt+Right.
- Sidebar: Home, Champion Select (live), Build Library, Champions, Pro Builds, Draft Simulator, Patch Tracker, Overlay, Settings, with tooltips when collapsed. The account card keeps the client status.
- Home: greeting, client status, current patch, quick actions, recently viewed champions and builds, favourite champions, latest changes (from Phase 9 once it exists; until then the patch number and a link to the notes).
- Recent items and favourites in the local store.

Dependencies: Phase 2.

Risks: the tier list has no menu entry in the brief. Decide in this phase whether it becomes a tab in Champions or in Build Library; don't drop it.

Acceptance:
- Every menu entry opens a working page, with no empty placeholder pages.
- Home shows no personal performance data.
- The menu can be used with the keyboard alone.

## Phase 4: Champion Select 2.0

Done. Decisions agreed with the owner on 2026-11-08:
- The page follows the draft. Planning, bans and other players' picks show the Draft view; the player's own pick turn with a hovered champion, a locked pick and finalization show the Build view. Draft and Build tabs override it until the next turn (`draft/logic.ts`, `autoView`). The backend now sends whose turn it is (`turn` in `champ_select.rs`), read from the session's actions, which carry cell ids only.
- Build tabs: General, each style variant with enough games, and "against {opponent}" when that matchup has enough games. No new backend data.
- Pro builds sit right under the win rate: three pro games side by side, no import. Same opponent first, then an opponent of the same Data Dragon class and damage type, then the same damage type, then the newest. The card says why it was chosen.
- The lane opponent is guessed from where each enemy champion is usually played, assigning the whole enemy team at once; it is marked as a guess and the player can correct it.
- Pick suggestions are one list scored from the role's tier list, the guessed opponent's matchups and the team's gaps, each row with its reasons and numbers. A gap every pick fills is said once above the list.
- Matchup guide: difficulty from our counters, the opponent's abilities and Riot's tips from Data Dragon, items bought noticeably more often against that opponent.
- Composition: frontline, backline, poke, pick and teamfight with who brings each and one line on what it means; the pick and teamfight lists are hand-kept in `data/traits.ts`.
- Imports: automatic per type on lock, manual buttons otherwise, a hovered champion is a preview with imports disabled. Results show as toasts; replacing a player's rune page names the page and can be cancelled; a result that lands after the champion changed is dropped.
- Desktop logic tests run with Vitest (`pnpm --filter @vizier/desktop test`).

Still to check with a live client: imports with no free rune page, and switching champion mid-import.

The plan as written before the work:
- Layout: my champion and role, both teams, build (runes, spells, starting, core and situational items, skill order), style variants that have enough games, sample size next to every rate.
- Matchup guide from visible enemy picks: difficulty from our counters, strengths and weaknesses, key abilities from Data Dragon, situational items.
- Composition analysis extended with frontline, backline, poke, pick and teamfight, each with a one-line explanation, built on `data/traits.ts`.
- Imports: a separate automatic switch for runes, spells and items, a manual button for each, a result toast, a confirmation before replacing a player's own rune page, and a retry. Keep the Rust safety rules.

Dependencies: Phase 2. Phase 5 reuses the build cards.

Risks:
- The LCU is unsupported, so endpoint changes can break imports. Keep the Rust tests and test against a live client.
- Never show stats for hidden players.

Acceptance:
- Imports work and fail cleanly with the client closed, with no runes page slot free, and when the champion changes mid-import.
- No style is shown without data.
- Works at 1280×720.

## Phase 5: Build Library

Done: the crawler publishes a `buildindex` doc, served at `/v1/builds/index`, and the desktop library searches it locally. Saved builds live under `vizier.library` with ids only; they can come from the library, a champion page, champ select or a pro game, and export through the existing importers. Collections start as Ana, Dereceli, Deneysel and ARAM. Until the new Worker is live the search tab says the index isn't published yet.

The plan as written before the work:

Work:
- Search and filters by champion, role, style, patch, item and keystone over the published build docs.
- Build detail: overview, runes (trees, keystone, shards), spells, items, skill order, description.
- Personal builds: create, edit, duplicate and delete, with notes, stored locally. Export to the client through the existing importers.
- Favourites and collections (for example Main, Ranked, Experimental, ARAM).

Dependencies: Phases 2 and 4 (cards and importers).

Risks:
- Searching every champion's build docs could mean many API calls. Add a compact build index doc to `stat_docs` instead of fetching each build.
- The local storage size limit. Store ids, not names or images.

Acceptance:
- A personal build survives a restart and can be exported to the client.
- Search answers in under 100 ms on a mid-range laptop.
- Every statistic shows its game count.

## Phase 6: Champions and champion pool

Done: a Champions page (roles from the five ranked tier lists, Data Dragon difficulty in three bands, favourite stars) and a pool manager with main and backup picks per role, a note and a saved build. `parsePersonal` turns old pool entries into main picks. Champion pages gained the title, lore and base stats; Data Dragon text is stripped to plain text, never rendered as HTML.

The plan as written before the work:

Work:
- A champion list with portraits, search, role and difficulty filters (Data Dragon `info.difficulty`), sorting and favourites.
- A champion detail page built from today's `ChampionPage`: splash, title, lore, passive and abilities with icons, base stats, strengths and weaknesses, builds, matchups.
- A champion pool manager: main and secondary picks per role, notes, favourite builds attached. This replaces the pool in `personal.ts`, with a migration of existing entries.

Dependencies: Phases 2 and 5.

Risks: Data Dragon text has tags such as `<br>` and placeholders. Render them safely, without `dangerouslySetInnerHTML` on raw strings.

Acceptance:
- Every champion in the current Data Dragon version opens.
- Pool entries from the old format survive.

## Phase 7: Pro Builds

Done: champion, team, player, region and patch filters, `/v1/pros/patches`, and a detail view per game. The client checks every answer against its filters, so an older Worker that ignores the new parameters can't show games that don't match.

The plan as written before the work:

Work: filters by champion, player, team, role, region and patch; a detail view with runes, spells, items, skill order, match time and patch; empty states when a filter has no games.

Dependencies: Phase 2. The data already exists.

Risks: tournament data has no source we may use, so it stays out unless one appears.

Acceptance: no fabricated entries, and every filter combination shows either results or an empty state.

## Phase 8: Draft Simulator

Done: five role slots per side, a picker filtered by the selected slot's role, an optional ranked pick order that drops a champion into its usual role when free, swaps, reset, saved drafts with duplicate, delete and a side-by-side comparison. The analysis is the same `analyzeComp`, `compDimensions` and `adviceAgainst` champ select uses. No bans and no win probability.

The plan as written before the work:

Work: blue and red sides, picks with roles, an optional pick order, search and filters, reset; both compositions analysed with the Phase 4 analysis; saved drafts with name, edit, duplicate, delete and compare.

Dependencies: Phase 4 (analysis) and Phase 2.

Risks: no win probability. Presenting one as fact is against the brief.

Acceptance: drafts survive a restart, and the analysis matches champ select for the same teams.

## Phase 9: Patch Tracker

Done on the device: `patches/diff.ts` compares `championFull.json`, `item.json` and `runesReforged.json` of two versions and caches the result per version pair outside the exported settings. Spot-checked against the raw JSON for 16.21.1 to 16.22.1: the same five champions and two items, same values. The page links to Riot's game update news rather than guessing a per-patch URL.

The plan as written before the work:

Work:
- Diff Data Dragon versions: champion base stats and per-level stats, ability cooldowns, costs and ranges where Data Dragon publishes them, item stats, prices and build paths, runes added and removed.
- Before and after values with the change, search, category filters, favourites, and a comparison of any two cached versions.
- Each patch links to Riot's official notes.

Dependencies: Phase 2.

Risks:
- Data Dragon doesn't cover every change. Damage numbers in ability text and system changes are missing. Say so on the page instead of guessing.
- The diff runs on the device or in the crawler. Cache it per version pair.

Acceptance: the diff between the current and previous version matches the raw JSON for a spot check of five champions and five items.

## Phase 10: Overlay 2.0

Not part of this plan; the owner is designing it. The notes below are kept for reference.

Work:
- Widgets: custom timer and stopwatch, quick notes, rune page reference, ability reference, item lookup, build checklist.
- A layout editor to drag, resize, toggle widgets and set opacity, with per-monitor positions stored by display id.
- Configurable hotkeys and optional click-through.
- Polling only while a game runs (already the case).

Dependencies: Phases 2 and 5 (the build checklist reads a saved or recommended build).

Risks:
- Fullscreen exclusive mode hides any overlay. Document borderless window mode.
- Global shortcuts can clash with other apps. Keep the current behaviour: register them only during games and fail quietly.
- No widget from the uncertain list returns without Riot's answer.

Acceptance:
- The overlay uses under 1% CPU and under 60 MB extra memory in a game.
- The layout survives restarts and monitor changes.

## Phase 11: polish and release

Done: ESLint (`pnpm --filter @vizier/desktop lint`, no errors; the remaining warnings are deliberate hook dependencies in older code), a Vitest suite for the local stores, build export mapping, draft and composition analysis, the patch diff and a translation check that fails on any Turkish string without English. Checked at 1280×720. The 1024×640 minimum was only checked by zooming the page in a browser, which does not trigger the narrow-width media queries, so it still needs a look in the real window. Testing Library was left out; the logic it would cover is tested directly. The release waits for the owner, together with the Phase 1 deploy steps.

The plan as written before the work:

Work:
- A visual pass at the four target resolutions.
- Translation check (no missing English keys; a script can list Turkish strings without an entry).
- Accessibility pass for focus order, contrast and reduced motion.
- vitest and Testing Library for the local store, build export mapping, the draft analysis and the patch diff.
- A linter.
- Release with `pnpm release`.

Acceptance:
- Typecheck, lint, all tests and the production build pass.
- The README and the policy review match what shipped.

## Added after the plan (2026-11-08)

- Champion riddle: classic, ability, emoji and skin modes, a daily riddle per mode and free play, local streaks and a copyable result. Emoji hints are Vizier's own.
- Draft simulator: ten bans and pick suggestions for the selected slot, using champ select's scoring.
- Champion page: a lane opponent picker that opens the matchup guide, the matchup build and the closest pro games.
- Champ select: a saved build attached to the pick in the player's pool, ready to import.
- Search palette: sections as well as champions.
- Pro games: one row per game and player even after a key change, and a fifteen-day lookback.
- Sections load on first use; the main bundle went from 501 KB to 334 KB.

## What comes next

The next round of work is in `BACKLOG.md`.

## Not planned

- Accounts or cloud sync.
- Win probability in the draft simulator.
- Parsing Riot's patch note pages.
- Any game memory access.
