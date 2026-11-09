# Backlog

The work after `IMPLEMENTATION_ROADMAP.md` (phases 0–11 are done). This list is about features a player sees: new tools and real improvements to the existing pages. Code health work only happens when a feature needs it.

Product scope: prepare, explore, customize. No post-game analysis or coaching (aggregate stats from the crawler are fine). Owner's decision on 2026-11-09: the in-game overlay is rebuilt to match Blitz's overlay feature set (epic 19), including the in-game benchmark overlay; the look stays Vizier's own (no Blitz assets, names or copy). Overlays that need game memory or cooldown data stay out (see 19).

## How to work through this file

- Epics are in priority order. Inside an epic, slices are in order.
- **Who takes which epic (owner's decision, 2026-11-09):** the cloud routine builds every open epic from 17 on, in order. Since 2026-11-10 that means the data expansion epics 32–41, in order. Local sessions only fix bugs and ship releases.
- **Runs can overlap.** Before starting a job, read `origin/main`'s BACKLOG: a slice with `<!-- claimed: <branch> <UTC time> -->` under it that is less than 3 hours old belongs to another run; take the next free job. Claim your job by adding that line under each of its slices, committing it on main as `docs: claim <ids>` and pushing before writing code. Remove the claim lines when you tick the slices.
- **Rust in the cloud:** first try `sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev librsvg2-dev libayatana-appindicator3-dev`, then `cargo test --lib` in `apps/desktop/src-tauri`. If the install fails, still write the Rust part with unit tests that don't need Tauri, keep it small and close to the existing code, and add "cargo check <slice ids>" to the Owner deploy queue.
- **One run is one job: the next 4–5 unchecked slices of the highest epic that isn't blocked**, built together as one feature on one branch (`auto/<epic>-<topic>`), one commit per slice. If the epic has fewer slices left, take the rest of it plus the start of the next epic. Don't stop after a single slice; a run should be long, finishing the whole job, and then start the next job if time is left.
- Merge the branch into main when the whole job is done and green. If time runs out mid-job, merge the slices that are finished and green, and leave a `<!-- in progress: ... -->` line under the next slice saying where you stopped. Never edit these instructions to record progress.
- Mark each slice `[x]` with the merge commit hash when it lands, e.g. `- [x] 3.2 ... (a1b2c3d)`.
- Don't split slices into smaller ones unless one is genuinely too big for a run.
- A slice that can't be done (missing data, needs a live client, needs an owner decision) gets `[-]` and one line saying why. Move on.
- Every slice ends with `pnpm --filter @vizier/desktop test`, `pnpm --filter @vizier/desktop lint` and `pnpm build:web` passing; API and crawler slices also run `pnpm --filter @vizier/api test`.
- File names must differ by more than case: Windows resolves `./banPlanner` and `./BanPlanner` to the same file. Name the component `BanPlannerPanel.tsx` next to the logic in `banPlanner.ts`. Linux builds don't catch this; `src/fileNames.test.ts` does.
- New logic gets Vitest tests. New Turkish strings get an English entry in `i18n.en.ts`. UI copy is short and plain.
- Every number shown to a player comes with its game count. Hide or grey out values with too few games instead of showing noise.
- New pages: add the route in `router.ts`, a lazy import in `App.tsx`, a menu entry in `Sidebar.tsx`, an entry in the search palette, and a `?view=` id for dev.
- Champ select work can't be tested against a real client in the cloud. Build it against recorded session fixtures (epic 1.1 adds the mock) and keep the LCU calls behind the existing Rust commands.
- Anything that needs a Worker deploy, a remote D1 migration or a VM restart must stay backward compatible; add the step to "Owner deploy queue" at the bottom instead of running it.

---

## 0. Augments 2.0

Owner's priority on 2026-11-08: augment stats that answer "which augment on which champion", in the app and in game.

- [x] 0.1 Augment ratings by lift: each augment is tiered by how far it moves a champion above that champion's own rate (`delta` on every augment row), so a strong champion's list isn't all S. Same doc keys, extra field.
- [x] 0.2 Champions per augment: crawler doc `augmentchamps:<queue>` with the ten champions each augment lifts most; route `/v1/augments/champions?queue=` behind the `AUGMENTS` switch.
- [x] 0.3 Augments page: sortable columns (tier, name, pick rate, win rate, games), a "best on" column with champion icons that opens the full list, and the lift shown when a champion is picked.
- [x] 0.4 Champion augment tier board: on the champion page in Arena and Mayhem, every augment in S–D rows with a rarity filter, win rate, lift and games.
- [x] 0.5 In-game augment card: in Arena (`CHERRY`) and Mayhem (`KIWI`) the overlay shows the champion's best four augments per rarity; setting "Augment önerisi", on by default. `?fixture=arena` previews it in dev.
- [x] 0.6 ARAM Mayhem (Şamata in the Turkish client) is live: the crawler asks queues 2400, 2401, 2403 and 2405 and stores them all as 2400. `services/crawler/src/probeQueues.ts` prints which queue ids have games.

## 1. Champ select: smarter preparation

The page players open most. Make every minute of champ select useful.

- [x] 1.1 Champ select mock: `src/dev/champSelectMock.ts` replays recorded session fixtures (`src/draft/fixtures/*.json`: blind, draft with bans, ARAM, Arena) step by step. `?view=draft&mock=draft` drives the real page with it. Needed by every slice below. (cbb6649)
- [x] 1.2 Situational item advisor: from the enemy team, recommend item answers with the reason — heavy healing → anti-heal, 3+ AP → MR item, 3+ AD/crit → armor or Randuin's, lots of hard CC → Mercury's/QSS, burst assassins → Zhonya's/GA, many tanks → %HP or armor pen. Rules in `draft/itemAdvice.ts` using `data/traits.ts` damage and CC profiles; only suggest items the champion's class actually buys (check against its build's item pool). Tests per rule. (cbb6649)
- [x] 1.3 Damage profile bar: AP / AD / true split for both teams, drawn from a per-champion profile table in `data/traits.ts` (hand-kept, tested so every current champion has an entry). (cbb6649)
- [x] 1.4 Composition 2.0: add engage, disengage, peel, waveclear and objective control to `compDimensions` with who brings each; extend `traits.ts`. (cbb6649)
- [x] 1.5 Game phase curve: early / mid / late strength per team from a per-champion curve in `traits.ts`, shown as three paired bars with a one-line read ("they outscale you; play for early dragons"). (cbb6649)
- [x] 1.6 Win conditions: detect the composition archetype for each team (dive, poke, protect-the-carry, split push, pick, teamfight) from the dimensions, and write two or three plain lines on how each team wants to play. (7eed8fd)
- [x] 1.7 Enemy threats list: for each enemy, the one ability to respect (longest-CD hard CC or the ultimate) with its cooldown at rank 1 and max, and their main power spike (level or item). (7eed8fd)
- [x] 1.8 Ban planner in the ban phase: suggest bans from three sources with the reason shown — meta (`/v1/bans`), the worst matchups of the champion the player is hovering or plans to play (pool main), and what is strong into the player's team so far. (7eed8fd)
- [x] 1.9 Pick suggestions "from my pool first" toggle and a score breakdown tooltip on each suggestion. (7eed8fd)
- [x] 1.10 Teammate picks: for each ally, the champion's win rate and games in that role, and a warning when the role looks off (champion rarely played there). (7eed8fd)
- [x] 1.11 Duo synergy hint for bot lane and jungle–mid from `/synergies`, shown next to the relevant ally slot. (74f7224)
- [x] 1.12 Hover advice: when hovering a champion, show the matchup line against the guessed lane opponent before locking (win rate, games, difficulty) so the player can change their mind. (74f7224)

## 2. ARAM and Mayhem companion

ARAM players get almost nothing from current tools. Make Vizier the best ARAM helper.

- [x] 2.1 LCU: read the ARAM bench (`benchChampions` in the champ select session) and the player's reroll count in the Rust champ select state; expose them to the frontend. Rust tests with a recorded session. (74f7224)
- [x] 2.2 Bench helper: rank the player's current champion, the bench and teammates' champions by ARAM win rate (queue 450) with game counts, and highlight "take this from the bench" when a bench champion is clearly better. (74f7224)
- [x] 2.3 Reroll advice: when the current champion is in the bottom part of the ARAM tier list and rerolls are left, say so. (74f7224)
- [x] 2.4 ARAM team composition: the same composition analysis tuned for ARAM (poke and sustain matter more, split push doesn't), with one line on the team's plan. (54179bf)
- [x] 2.5 ARAM builds in champ select: when the queue is ARAM or Mayhem, the build tab uses the queue's build docs and imports the ARAM item set. (54179bf)
- [x] 2.6 Mayhem augments in champ select: the champion's best augments for Mayhem (from the existing augment docs; respects the `AUGMENTS` switch), shown as a short pick order. (54179bf)
- [x] 2.7 ARAM tier list page tab with its own sorting by win rate and pick rate. (54179bf)

## 3. Arena companion

- [x] 3.1 Arena champion page: best augments per champion (existing data), best items once available, and the champion's Arena win rate. (54179bf; augments and the Arena rate were already on the page, the item list follows with 3.4)
- [x] 3.2 Arena duo helper: in Arena champ select, show the partner's champion and suggest picks that pair well (from Arena games where both champions were on the same team; needs a crawler rollup of duo pairs for queue 1700, backward compatible). (949d3b2; the rollup pairs Arena players by subteam, docs `duos:1700:<champion>`, route `/v1/arena/duos/:championId`)
- [x] 3.3 Arena augment tier list page with filters by rarity tier (silver, gold, prismatic) and by champion class. (949d3b2; class view merges the most played champions of the class)
- [x] 3.4 Arena items: crawler rollup of item win rates for queue 1700 (same `AUGMENTS`-style switch, named `ARENA_ITEMS`, default on), then the item list on the Arena champion page. (949d3b2; item counts were already rolled up, the new doc is `arenaitems:1700:<champion>`)

## 4. Matchup explorer

A dedicated place to study any matchup before the game, not only during champ select.

- [x] 4.1 Matchup page (`{ page: "matchup", championId, opponentId, position }`): pick two champions and a role. Shows win rate and games, difficulty, the matchup build and runes, items bought more often in this matchup, and the player's own note for it. (949d3b2; the page is reachable from the menu and the search palette, the other entry points follow with 4.6)
- [x] 4.2 Base stats duel: both champions' HP, AD, armor, MR, attack speed and range at levels 1, 3, 6, 11, 18 from Data Dragon growth formulas, with who is ahead at each level. Tests against known values. (949d3b2)
- [x] 4.3 Ability comparison: cooldowns of each basic ability and ultimate at rank 1 and max side by side, with the "window" lines ("their E is on a 14 s cooldown at level 3: trade when it's down"). (87b9c6e)
- [x] 4.4 Power spikes timeline: level 2/3/6/11/16 and core item completions for both champions on one horizontal timeline. (87b9c6e; item rows are in buy order, minutes follow with 5.6)
- [x] 4.5 Lane stats from the crawler: average gold and CS difference at 10 and 15 minutes, first blood rate and lane kill rate for this matchup (new aggregate rollup from timelines; backward compatible doc). (87b9c6e; first blood and gold/CS leads only, lane kill rate is not in the match data; needs migration 0013)
- [x] 4.6 Entry points: open the matchup page from the champion page counters list, from champ select, from the tier list (right-click or a button) and from the search palette ("Ahri vs Zed"). (87b9c6e)

## 5. Champion page improvements

- [x] 5.1 Rune page visual: both trees and shards laid out like the client, chosen runes lit, alternatives dimmed with their pick rates (needs per-rune pick rates from the crawler; backward compatible field in the build doc). (d8a0f1e; per-rune counts are new, so rates fill in as games are rolled up)
- [x] 5.2 Build path timeline: starting items → first back → three core items → situational, with games and win rate on each step. (d8a0f1e; no first-back step, the match data has no recall timing)
- [x] 5.3 Boots and summoner spells comparison tables with pick rate, win rate and games. (d8a0f1e)
- [x] 5.4 Skill order: the common first-three and max orders with their win rate and play rate (crawler rollup), on top of the existing grid. (d8a0f1e; skill option rollup reuses the existing skill counts)
- [x] 5.5 Ability details: cooldown, cost and range per rank from `championFull.json`, with "–" where Data Dragon doesn't publish a value. (d8a0f1e)
- [x] 5.6 Item completion times: the minute each core item is usually finished (crawler rollup from timeline purchase events). (2bdb429; crawler rollup of first purchase times; needs migration 0014)
- [x] 5.7 Synergies tab: best duo partners (bot + support, jungle + mid) with games. (2bdb429; teammates grouped by role, duo partner role first, pairings under 20 games hidden)
- [x] 5.8 Similar champions: same class and damage type, closest base stats; quick links. (2bdb429; same main class and damage type, nearest level-one stats)
- [x] 5.9 Skins gallery from CommunityDragon, lazy-loaded. (2bdb429; skins and splash art come from Data Dragon, already used for the page background)
- [x] 5.10 Queue picker in the header: ranked, ARAM, Mayhem, Arena, using each queue's docs. (2bdb429; the mode tabs existed; they moved into the header)

## 6. Tier list improvements

- [x] 6.1 Honest tiers: tier from a score that shrinks win rate toward the role average by sample size (Bayesian or Wilson), so a champion with few games can't reach S on win rate alone. Same response fields, so old clients keep working. Tests with fixed counts. (da33aa2; shrinks towards the role average with the existing 1500-game prior; same response fields)
- [x] 6.2 Win rate change versus the previous patch (fill `winRateChange` in the crawler when both patches have enough games) shown with an arrow and colour. (da33aa2; the API already filled winRateChange; the page now shows an arrow and tooltip)
- [x] 6.3 Low-sample rows: lower the cut-off but mark rows under the threshold with a badge and a toggle to hide them. (da33aa2; the API lists champions from 30 games, the app flags rows under 100)
- [x] 6.4 Sorting by every column, search by name, a "my pool only" filter, all kept in the route state. (da33aa2; view state lives in the tiers route, so Back keeps it)
- [x] 6.5 Meta movers card on the tier list and Home: biggest win rate and pick rate risers and fallers this patch. (da33aa2; adds pickRateChange to tier rows; the card sits on Home and under the ranked tier list)
- [-] 6.6 Tier list by rank band (Emerald, Diamond, Master+): add region and tier to the crawler's counts (new migration, backward compatible) and a query parameter; old clients keep the pooled list. (Needs an owner decision: the crawler does not store the fetching player's tier per game, and per-band counts would multiply the pool rows written to D1.)
- [x] 6.7 "How tiers are made" popover with the real rule and the game count. (847a7be; the Worker sends the rule with the tier list, so the text uses the real numbers)

## 7. Champion pool builder

Help players build a pool that covers their role, not only store it.

- [x] 7.1 Pool coverage: for the role's 20 most played opponents, which pool champion has the best matchup against each, and the opponents nobody in the pool handles well. (847a7be; pool picks without a role use the role the champion is picked in most)
- [x] 7.2 Pool suggestions: champions that would fill those gaps, ranked by matchup win rate against the gap opponents, tier and similarity to what the player already plays. (847a7be; candidates are the role's 12 best-tier champions outside the pool)
- [x] 7.3 Blind pick pick: mark which pool champion is safest blind (fewest bad matchups among common opponents). (847a7be; shown when the role has two or more pool champions)
- [x] 7.4 Pool patch watch: on Home and the pool page, which pool champions changed in the latest patch and how their win rate moved. (847a7be; win rate moves come from the role tier lists; the patch-changed tag reads the patch tracker cache)
- [x] 7.5 Pool export: one button to write item sets for every pool champion into the client (reuses the item set importer), with a summary toast. (0da66ec; one button on the pool page; picks use their chosen saved build or the recommended one)

## 8. Champion journal

- [x] 8.1 Journal page: every champion note and matchup note in one place, searchable, grouped by champion, with jump links. (0da66ec; new Journal page in the menu; notes are opened or removed from there)
- [x] 8.2 Note templates: a matchup note starts with optional headings (lane plan, all-in window, what to avoid) the player can delete. (0da66ec; headings show in an empty matchup note and are never saved untouched)
- [x] 8.3 Notes show up where they matter: the matchup note in champ select and on the matchup page, the champion note on the champion page and in champ select. (0da66ec; the matchup note previews at the top of champ select and the counters mark opponents you wrote a note for; the editors already existed on the other pages)
- [x] 8.4 Notes export and import as part of the existing local data export. (0da66ec; the full local data export already held the notes; the journal adds a notes-only file that merges without overwriting)

## 9. Build library improvements

- [x] 9.1 Build comparison 2.0: most popular vs highest win rate (with a minimum games bar) vs against AP / AD / tank teams, side by side with game counts. (fddc671; the comparison opens with the popular build, the best win rate above a games bar and the AP, AD and tank answers side by side; the foe columns have no win rate because the data only counts games)
- [x] 9.2 Item explorer page: every item with stats, cost, build path, gold efficiency (base stat prices, tested) and the champions that build it most (from the build index). Filters by stat and price. (fddc671; Items page; gold efficiency uses the hand-kept stat prices in data/itemGold.ts; "builds it" means the item is in the champion build index, not that every game has it)
- [x] 9.3 Rune explorer page: every keystone with the champions that use it most and their win rate with it. (fddc671; Runes page lists keystones; win rate is the weighted rate of the champion builds that take the keystone)
- [x] 9.4 Build editor: drag to reorder items, item search with stat filters, duplicate warning; rune editor validation and "copy from recommended". (fddc671; drag or Alt+arrows to reorder, stat filter in the item search, repeated item warning, rune page checks, copy runes or items from the recommended build)
- [x] 9.5 Tags and sorting in the library (last edited, champion, collection). (fddc671; free-form tags (up to 6 per build) with a tag filter, and sorting by last edit, champion, name or collection)
- [x] 9.6 Share codes v2: shorter codes that still read v1; pasting a code anywhere in the app offers to open it. (a1aef51; VZ2 codes pack ids as varint bytes (about half the length); VZB1 codes still read; pasting a code outside a text field asks whether to add the build)
- [x] 9.7 Build diff between two saved builds. (a1aef51; pick another saved build in the build view to see runes, spells, items and skill order that differ)
- [x] 9.8 Search the build index by item ("who builds Rabadon's") and keystone. (fddc671; the build explorer already filtered by item and keystone; no new work)

## 10. Queue and lobby companion

- [-] 10.1 LCU gameflow phases (lobby, matchmaking, ready check) in the frontend state; Rust tests with recorded events. (The cloud sandbox cannot build the Tauri crate (no webkit2gtk), so Rust code and its tests cannot be run here; do it on a machine that can run cargo test.)
- [-] 10.2 Queue view: while in queue, show the selected roles' pool champions with their current tier, a patch change badge and their saved build, plus "if you get autofilled" picks for the other roles (easiest high win rate champions). (Needs the selected roles from the lobby (10.1).)
- [x] 10.3 Ready check: optional sound and taskbar flash when a match is found (setting, off by default). (a1aef51; setting "Maç bulununca haber ver", off by default; uses the phase the app already gets, adds the request-user-attention window permission)
- [x] 10.4 Lobby: when the player sets roles, preload the data champ select will need so it opens instantly. (a1aef51; the lobby, queue and ready check phases fetch static data, tier lists for the pool roles, bans and the pool builds into the API cache; roles are not read from the lobby (see 10.1))

## 11. Pro play

Worlds and pro builds are a top priority for the EUW audience.

- [x] 11.1 Pro player pages: recent games, most played champions, usual runes and items, team and region. (9828989; pro page links from every pro name; stats come from the stored 30 days of games, no new data)
- [x] 11.2 Pro meta page: most picked and banned champions in pro games this patch, by role, with their win rate in pro games. (9828989; picks and win rate only, bans are not stored; new route /v1/pros/meta)
- [x] 11.3 Followed pros on Home: their newest games. (9828989; already on Home before this job; player names now open the pro page)
- [x] 11.4 Pro games on the champion page and matchup page, same opponent first. (9828989; already shipped: champ select, champion page and matchup page list pro games with the same opponent first)
- [x] 11.5 Save any pro build to the library in one click from every view. (9828989; Save button on Home, champion page and champ select pro cards too)
- [-] 11.6 More pro accounts: LCK, LPL, LEC and LCS players whose solo queue accounts are public, with name-matching tests. (Not done: the solo queue accounts of LCK, LPL, LEC and LCS players can't be checked from here, and guessed Riot IDs would show other people's games. Needs an owner-supplied list.)

## 12. Draft simulator improvements

- [x] 12.1 Load the current champ select into the simulator. (66bd2d4; the button is on while champ select is open; your team is blue, hovered champions count)
- [x] 12.2 Share a draft as text and as a code; import from a code. (66bd2d4; VZD1 codes; the copied text ends with the code; paste a code into the box above the teams)
- [x] 12.3 Undo and redo. (66bd2d4; Ctrl+Z and Ctrl+Y or the buttons; 100 steps)
- [x] 12.4 The new champ select analysis in the simulator: damage profile, phase curve, win conditions, threats (epics 1.3–1.7). (66bd2d4; phase curves, win conditions and threats for both teams; damage split and dimensions were already there)
- [x] 12.5 Keyboard flow: type to search, Enter to pick into the selected slot, Tab to the next slot. (66bd2d4; type anywhere to search, Enter picks the first result, Tab and Shift+Tab walk the slots)
- [x] 12.6 Clash planner: up to five players with their pools saved locally; the simulator suggests a draft that uses each player's pool and covers the team's needs. (roles go to each player's first or second choice; picks weigh the role tier list against a frontline, engage, peel and mixed damage; red picks and bans are skipped; saved under `vizier.clash`, so the local data export carries it)

## 13. Patch tracker improvements

- [x] 13.1 Per-level stat changes shown at level 1 and level 18, not only the raw growth number. (4a9f5d2; level 18 line next to the growth number; the base stat is labelled level 1; cached diffs recompute once)
- [x] 13.2 Ability cooldown and cost changes per rank, item recipe and build path changes. (4a9f5d2; per-rank cooldown and cost already showed as 10/9/8; added what an item builds into)
- [x] 13.3 Buff / nerf / mixed label per champion and item from simple rules. (4a9f5d2; label from the direction of each number, none for recipes and new entries)
- [x] 13.4 Pool champions first and a Home badge when one changed. (4a9f5d2; pool and favourites first in the tracker; Home pool cards say when the patch changed them (reads the tracker's cache))
- [x] 13.5 Win rate before and after the patch for each changed champion (uses 6.2). (4a9f5d2; shown for the newest patch only, since the change compares the latest two crawled patches; loads on its own for the pool, on click for others; hidden under 100 games)
- [x] 13.6 A champion's change history over the cached versions on its page. (reads the tracker's cached diffs; the pairs not read yet load on request, one at a time)

## 14. Home

- [x] 14.1 "This patch for you" card: pool champions' tier, win rate change and patch changes in one glance. (replaces the separate pool patch and pool win rate sections on Home; patch changes come from the tracker's cache)
- [x] 14.2 Meta movers card (6.5) and followed pros card (11.3). (both were already on Home)
- [x] 14.3 Customisable Home: show, hide and reorder cards; saved in settings. ("Ana sayfayı düzenle" under the greeting; the pro panel stays in the right column and can only be hidden)
- [x] 14.4 Search palette: items, runes, pro players, saved builds and "X vs Y" matchups as result types. (pros and "X vs Y" were already there; items open the item explorer, keystones the rune explorer and saved builds the library with that build selected)

## 15. Riddle and fun

- [x] 15.1 Item recipe mode: guess the item from its components. (a3e1739; recipe mode; the answer is shown as its component icons, price and combine cost open as hints)
- [x] 15.2 Ability icon mode with rotation and greyscale difficulty steps. (a3e1739; the icon starts turned and grey, straightens and gains colour with wrong guesses)
- [x] 15.3 Stats page: streaks, guess distribution, history per mode. (a3e1739; Statistics tab: per-mode played, streak, best streak, guess distribution and the last 14 days; daily games only)
- [x] 15.4 Item game timed mode with a local best score. (a3e1739; Timed tab in the item mode: 60 seconds, skip allowed, best score kept locally)

## 17. The app works by itself

Owner feedback 2026-11-09: the app feels useless because everything waits for the player to open a page. Make the useful things happen on their own.

- [x] 17.1 Auto-import on by default: runes, spells and item set import when the champion is locked, for new installs and once for existing installs (settings migration that flips the three switches on and remembers it ran). The import uses the build the player picked on the build page, else the recommended one, and the queue's build docs (ARAM, Mayhem, Arena). (dc4214a; defaults on, flipped once for existing installs)
- [x] 17.2 Import toast in the main window and a small one on the client side of the screen: "Ahri: rünler, büyüler ve eşya seti aktarıldı" with a link to change the build; errors say what failed (no free rune page, client closed) instead of failing silently. (dc4214a; one summary toast with the reason per failure and a change-build link; the separate client-side corner toast is not built, the main window comes up on champ select instead)
- [x] 17.3 Follow the client: when champ select starts, bring the main window up and open the champ select page (setting "Şampiyon seçiminde öne gel", on). When the game starts, send the main window to the tray (setting, on). When the game ends, restore it if it was up before. (dc4214a; champ select brings the window up (existing), game start hides it, game end restores it if it was up)
- [x] 17.4 Start with League: Vizier already autostarts with Windows; make it start hidden in the tray and show itself when the League client opens (setting). Tray menu: open, champ select, overlay on/off, quit. (dc4214a; tray menu (open, champ select, overlay, quit) and the window shows when the client opens; hidden start was already there)
- [x] 17.5 Item set check: after an import, read the item sets back from the client and confirm ours is there for the right champion; show the result in the toast. Tests for the merge (Rust) and the toast text. (dc4214a; item sets are read back after the write; the toast says if the client did not keep ours)

## 18. Auto pick, ban and lock

- [x] 18.1 Rust LCU actions behind typed commands: hover a champion, lock it, ban (`PATCH /lol-champ-select/v1/session/actions/{id}` with `championId` and `completed`), accept the ready check (`POST /lol-matchmaking/v1/ready-check/accept`), swap from the ARAM bench (`POST /lol-champ-select/v1/session/bench/swap/{championId}`). Read `/lol-champ-select/v1/pickable-champion-ids` and `bannable-champion-ids`. Unit tests with the recorded session fixtures for finding the player's current action. (6ce510d; actions.rs with Rust tests on session JSON; typed wrappers in lcuActions.ts)
- [x] 18.2 Pick plan per role: up to three picks and two bans per role in priority order, edited on the pool page (drag to reorder) and saved in `personal`. Skips champions that are banned, taken by anyone or not owned. (6ce510d; plan stored in personal, edited under the pool on the Champions page)
- [x] 18.3 Auto hover and lock: when the player's pick turn starts, hover the first available plan pick; lock it right away or N seconds before the timer ends (setting: off / hover only / hover and lock, and the seconds). Auto ban the same way. A clear banner in champ select says what Vizier will do and a button cancels it for this game. (6ce510d; off by default; hover only or hover and lock, lock now or N s before the end; banner with per-game cancel)
- [x] 18.4 Lock from Vizier: "Seç" and "Kilitle" buttons on pick suggestions, pool cards and the hover advice; disabled outside the player's turn with the reason in the tooltip. (6ce510d; Seç and Kilitle on pick suggestions, hover advice and pool picks)
- [x] 18.5 Auto accept ready check (setting, off by default; uses 18.1) and one-click bench swap on the ARAM bench helper. (6ce510d; auto accept off by default; swap button on bench rows)

## 19. Overlay rebuild: Blitz's overlay feature set

The owner's call: the same overlay features Blitz ships, built fresh in Vizier's style. Data only from the Live Client Data API, LCU, Vizier's API and Data Dragon. Not possible without game memory or cooldown data, so not built: automatic jungle camp timers, ally ultimate timers, ARAM health relic timers, trinket reminder, live jungle split times. Their compliant stand-ins stay (manual camp timers, first spawn reminders).

- [x] 19.1 Overlay architecture: one file per widget under `src/overlay/widgets/`, a registry (id, name, modes it runs in, default spot, settings key), layouts saved per mode (Rift, ARAM, Arena, Mayhem) and per screen size, snap to an 8 px grid, a scale setting. The current six boxes move into the registry unchanged. `?fixture=<mode>` previews each mode in dev; Vitest covers the registry and layout logic. (24d8519; registry, per-widget files, layouts per mode and screen size, 8 px grid, scale, ?fixture=rift|aram|arena|mayhem; the Playwright reference shots stay in 19.10)
- [x] 19.2 Overlay settings page rebuilt: every widget with a preview picture of it, its toggle, the modes it shows in, and rebindable hotkeys (saved in settings, sent to Rust). "Kutuları yerleştir" opens edit mode from the page. (24d8519; preview per widget, toggles, modes, scale, edit button, rebindable hotkeys sent to Rust (set_hotkeys))
- [x] 19.3 Loading screen scouting: when the loading screen starts, a panel with all ten players: rank, LP, season win rate and games, games and win rate on the champion this season, champion mastery, and neutral tags (main, first time on the champion, autofilled, on a win or loss streak), plus each team's AP / AD / true damage split (from `data/traits.ts`). It hides when the game starts or on the hotkey. Data: a new Worker route `/v1/scout` that calls the Riot API with a `RIOT_KEY` Worker secret (never in the app or the repo), caches each player in KV for 15 minutes and stays inside the free plan; the route returns 503 when the secret isn't set and the panel then shows only the damage split. The `RIOT_KEY` secret is already set (2026-11-09, the same key the crawler uses on the VM); the crawler takes `RIOT_SHARE` of its limit, so keep the Worker's calls inside the rest and back off on 429. (24d8519; /v1/scout on the Worker with the RIOT_KEY secret, cached 15 min in the D1 cache table instead of KV to stay inside the free write limits; panel shows rank with games, win rate, mastery points, neutral tags (main, new on the champion, win streak) and the damage split. Season games and win rate on the champion and autofill need match history or preferences Riot does not give cheaply, so they are not shown)
- [x] 19.4 Benchmark overlay: own CS per minute, kill participation, KDA and level against the Emerald+ average for the champion and role at the current minute, with a small CS-difference sparkline. Needs a crawler rollup of per-minute CS and level by champion and role from timelines (new doc `bench:<queue>:<champion>:<role>`, backward compatible, written only when changed). (24d8519; CS and level against the Emerald+ average at minutes 3 to 15 with game counts, from new bench_sums and doc bench:420:champion:role; kill participation and KDA benchmarks are 19.4b)
- [x] 19.5 Skill order overlay: the skill to level now (exists) next to the ability bar, plus the full 18-level order strip on a hotkey. (24d8519; strip of all 18 levels on Ctrl+Shift+K (rebindable), skill hint placed above the ability bar)
- [x] 19.4b Benchmark of kill participation and KDA at the current minute: needs per-minute kill, death and assist sums from timeline events in the crawler rollup. (b80c160; migration 0017 adds kda_minutes and kda sums; bench docs gain optional kdaGames, kills, deaths, assists and killParticipation, shown only with 20+ games; the overlay adds a K/D/A row and a kill participation row)
- [x] 19.6 Item value difference: per lane pair on the Tab scoreboard (exists) and the team totals, restyled for 19.1. (baae798; team total chip under the Tab scoreboard rows)
- [x] 19.7 Minimap timers: dragon, Baron, Herald and inhibitor respawns (exist) drawn next to their spots on the minimap, and the manual camp timers drawn on the camps. Minimap side and size come from a setting matching the game's minimap options. (baae798; minimap pins for dragon, Baron, inhibitors and manual camps; corner, size and jungle side in settings; Herald has no respawn timer in the Live Client events so only its first spawn stays in the card; spots are rough editorial readings)
- [x] 19.8 Augment overlay for Arena and Mayhem: the champion's augments with tier, win rate and games while the augment pick is open (the Live Client API doesn't say which three are offered, so the panel lists the best per rarity and has a search box the player types into). (baae798; win rate and games per augment (greyed when thin), hide hotkey Ctrl+Shift+A; the overlay is click-through so a typed search box is not possible without taking focus from the game, the full list per rarity stays on the Augments page)
- [x] 19.9 In-game build panel on a hotkey: the imported build's items in order with what's owned ticked, runes and the skill order, and the next item with gold left (exists, moves here). (baae798; panel on Ctrl+Shift+I with owned items ticked, runes, skill order and next item with gold left)
- [x] 19.10 Overlay visual tests: screenshot each mode's fixture in edit and play states with Playwright against `pnpm dev`, kept as reference images. (baae798; `pnpm --filter @vizier/desktop shots:overlay` writes e2e/overlay/*.png, `-- --check` compares; shots run without Data Dragon so item-based boxes are not in them)

## 20. Data you can trust

- [x] 20.1 Crawler throughput report on the VM log and a `/v1/meta/coverage` route: games per patch, per queue and per region, and timeline share, so thin data is visible. Tune the crawl split if timelines lag. (c0f58b3; coverage doc, `/v1/meta/coverage`, hourly crawler log; timeline share is about a quarter, split left as is)
- [x] 20.2 Thin data fallbacks: where a matchup has too few games, fill from the champion's general build and the closest matchups (same class and damage type), labelled as such, instead of an empty "yeterli veri yok" line. Sections with nothing to show collapse. (c0f58b3; pooled stand-in from same-class opponents in the matchup guide and hover line, empty lane panel collapses)
- [x] 20.3 Data Dragon JSON cached per version in IndexedDB (A6) so pages open instantly after the first run. (c0f58b3; IndexedDB cache per version, last version kept for offline)
- [x] 20.4 Offline and error audit: every page has a clear offline state and retry; the API being down never shows a blank page. (c0f58b3; offline chip in the top bar, retry states on matchup, pro meta and champ select)

## 21. Lobby and queue (picks up 10.1 and 10.2)

- [x] 21.1 Build 10.1 (gameflow phases and lobby roles in the frontend state, Rust tests with recorded events) using the Rust setup above. (52b9d16; lobby.rs reads the queue and own role picks from /lol-lobby/v2/lobby (party and names dropped), `lcu-lobby` event and `lobby` command, `clientFlow.ts` maps phases, preload now fetches the lobby roles; 4 Rust tests)
- [x] 21.2 Build 10.2 (queue view with the pool for the chosen roles and autofill picks). (52b9d16; queue view: pool picks for the lobby roles with tier, win rate, games, badge, patch change and saved build, plus easy high-win-rate autofill picks for the other roles (home/QueueView.tsx))
- [x] 21.3 Home follows the client: client closed → patch and meta card first; lobby → the pool for the chosen roles; in queue → the queue view. (52b9d16; Home shows the pool in the lobby and the full queue view while searching; with the client closed the patch and meta cards come first unless the player arranged Home)

---

# Prepare. Explore. Master. Customize. (owner's product brief, 2026-11-09)

Epics 22–31 come from the owner's product brief. Rules that apply to all of them:

- Extend what exists; never build a second version of a page, store, search or draft engine. Each slice names what it builds on.
- Never fabricate numbers. Every win rate, pick rate or sample shown goes through `DataBadge` (`src/ui/DataBadge.tsx`, rule in `src/data/confidence.ts`). Hand-kept tables (traits, archetypes, difficulty, combos, scenarios) are labelled with `<DataBadge editorial />` and never shown as statistics.
- Not in scope: post-game analysis, AI coaching, player profiles or performance dashboards, growth tracking, tilt detection.
- Editorial content (combo text, academy text, scenarios) is written fresh in plain language, Turkish first with English entries. Nothing is copied from guides, wikis or other sites.

## 22. Data confidence everywhere (F1)

The rule and badge exist (b4b6e62, on the build summary and the matchup guide).

- [x] 22.1 Replace the scattered sample cut-offs (`MIN_GAMES` in MatchupGuide, banPlanner, MetaPicks, comparison, ChampionPage, proMeta, winRateShift, `BAR_MIN_GAMES`) with `confidenceOf`: hide or grey values that are `insufficient`, badge the rest. Keep each page's behaviour where a cut-off exists for a non-statistical reason, and say why in a comment. (52b9d16; one `hasEnoughGames` rule (95% interval within 10 points) replaces the matchup, meta pick, shift and ban planner cut-offs; kept with a reason: pick-rate row floor, bar width, similar champions, tier pick floor)
- [x] 22.2 Difficulty labels only when the data supports them: "Rahat / Zor eşleşme" shows only when the 95% interval lies fully above or below 50%; otherwise "Dengeli ya da belirsiz" with the badge. Same for counters lists, pick suggestions and the ban planner reasons. Tests with fixed counts. (52b9d16; hard/easy only when the interval clears 50%, otherwise "Dengeli ya da belirsiz"; same for counter lists, pick suggestion reasons and ban reasons)
- [x] 22.3 Badges on the tier list, champion page header, counters, synergies, runes, boots and spells tables, augments, Arena items and pro meta. Tier list rows get the badge in the tooltip instead of a chip to keep rows compact. (cad7db6; badges on champion page header, counters, allies, tier list (header badge, rate tooltip per row), augments, Arena items, boots, spells and pro meta; list badges use the pooled sample of the rows shown)
- [x] 22.4 Data freshness: the Worker already knows when each doc was published; add `updatedAt` to responses (backward compatible) and show "güncellendi 3 saat önce" in the badge tooltip. Outdated (older patch) data is labelled on every page. (cad7db6; stat docs carry `updatedAt` (last changed publish), badge and row tooltips say "x saat önce güncellendi"; outdated data gets the "Eski veri" badge. Worker deploy needed to serve updatedAt (queued))
- [x] 22.5 "Veriler nereden geliyor" page under About: sources, regions and ranks, patches kept, the confidence rule in plain words, what is editorial. Linked from every badge tooltip. (cad7db6; "Veriler nereden geliyor" section on About (sources, regions, patches, confidence rule, editorial); every badge is a link to it)

## 23. Itemization Lab (B1, highest priority of the brief)

Builds on: build docs and variants (`Build.variants`, `situational`), the item explorer and gold values (`data/itemGold.ts`, `library/gold.ts`), build comparison (`buildSideBySide.ts`, 9.1), the build editor (9.4) and the library store.

- [x] 23.1 Lab page (`{ page: "lab", championId, position }`, menu, palette, `?view=lab`): pick champion and role, then up to three build columns side by side. Each column: items in order with cost, total gold, runes, boots, spells, patch, games and badge. Columns start as popular / highest win rate / the player's saved build. (cad7db6; lab page `?view=lab`, menu, palette: popular, best win rate (enough games) and saved build columns with items, cost, spike gold, boots, spells, runes)
- [x] 23.2 Build directions: standard, burst, anti-tank, sustain, defensive, hybrid, poke, utility. A direction is a rule over item stats and tags (tested), applied to the champion's item pool from the build index; directions with real data (situational vs AP / AD / tank) use it and say so; the rest are labelled editorial. (cad7db6; 8 directions as tested tag/stat rules over the champion's build items; anti-tank uses the vs-tank item data, the rest are labelled editorial)
- [x] 23.3 Stat totals per column: AD, AP, HP, armor, MR, haste, attack speed, crit, penetration, lifesteal/omnivamp, from Data Dragon item stats summed at full build and after each item. A row chart compares the columns. No damage or DPS numbers. (ec1a42c; stat totals per column (AD, AP, HP, armor, MR, attack speed, crit, life steal, mana, move speed) at full build and after each item, bars on one scale; penetration, haste and omnivamp are not in Data Dragon item stats so they are not shown)
- [x] 23.4 Custom column: edit items with the existing build editor inside the lab, compare against popular, pro and saved builds, save to the library in one click. (ec1a42c; custom column edited with the build editor, pro build column (one pro game, no badge), one-click save to the library)
- [x] 23.5 "Bu build ne için" line per column from its stat profile ("magic pen and burst: kills squishy targets; little survival"), from tested rules. (ec1a42c; purpose line from tested stat rules, labelled editorial)

## 24. Matchup Academy and Combo Library (C1, C3)

Builds on: the matchup page (4.1–4.6: lane stats, stats duel, ability compare, power spikes, build vs), threats (`draft/threats.ts`), the journal notes and templates (8.x).

- [x] 24.1 Academy layout for the matchup page: sections for strengths, weaknesses, abilities to track (cooldowns from Data Dragon), early / mid / late (from the phase curves), level and item breakpoints (power spikes), item interactions (item advice rules), lane stats. Each section marks its source: Data Dragon, crawler or editorial. (ec1a42c; academy sections each with a source tag (Data Dragon, crawler, editorial); new phase read and strengths sections, existing guide, abilities, spikes, item advice and lane stats moved in)
- [x] 24.2 Champion strengths and weaknesses table (hand-kept, every champion, tested for coverage), written plainly; used by the academy and the champion page. (ec1a42c; data/strengths.ts, 16 strength and 10 weakness phrases, every champion in the quiz facts table covered (test); shown on the champion page and in the academy with the editorial badge)
- [x] 24.3 Personal academy notes: reminders and favourite plans per matchup on top of the journal note (same store, new optional fields), shown in champ select. (85cbcf1; reminders and favourite plans per matchup (up to 5 each) in personal.academy, edited on the matchup page and shown read-only in champ select)
- [x] 24.4 Combo data model and the first 40 champions (most played in the crawler): name, difficulty, ability sequence, purpose, timing notes, common mistakes, category (basic, trading, all-in, burst, escape, flash, teamfight, animation), patch checked. Stored in the repo as JSON with a schema test; all labelled editorial. (85cbcf1; data/combos.json: 45 combos for 40 champions, Turkish and English, tested schema; written from game knowledge against 16.21, editorial and unreviewed by the owner)
- [x] 24.5 Combos section on the champion page and a Combo Library page with search and category filters; the sequence is drawn with ability icons and arrows (original drawing, no video or copied art). (85cbcf1; combos on the champion page and a Combo Library page with search and category filters; sequences drawn with Data Dragon ability icons and arrows)
- [x] 24.6 Combos for the remaining champions, plus a patch check that flags combos whose abilities changed in the patch tracker's diff. (3a95a12; all 171 champions have at least one combo, written from game knowledge against 16.21, editorial and unreviewed by the owner)

## 25. Champion intelligence (A1–A4)

Builds on: synergies doc and the champion page synergies tab (5.7, 1.11), counters, pool coverage (7.1), `data/traits.ts` (classes, damage, dimensions, curves), win conditions (1.6).

- [x] 25.1 Archetype table: the 18 archetypes of the brief, many per champion, hand-kept and tested for coverage; each archetype has a short description, strengths, weaknesses and its usual team role. (85cbcf1; data/archetypes.json: 18 archetypes (own list, the brief's list was not in the repo) and 1-3 per champion for every champion, coverage tested, editorial)
- [x] 25.2 Archetype Explorer page: browse and combine archetypes ("disengage + protect the carry"), filter by role, search; links into synergies and the champion page. (85cbcf1; archetype explorer: combine types (a champion needs all), search, role filter from the build index, opens the champion page (its synergies list); no separate synergy link)
- [x] 25.3 Synergy Explorer page from the Champions section: champion and role in, partners out, with crawler data (games, win rate, badge) and the reason from category rules (engage + follow-up CC, wombo, protect the carry, dive, poke, scaling, lane pressure, disengage) built on archetypes and dimensions. Pairs without data show the reason only, marked editorial. Sort by data or by category. (ac64d3a; synergy explorer page `?view=synergy`: partners with games, win rate and badge where the sample is judgeable, rule-based reasons (data/synergyReasons.ts: engage, wombo, protect, dive, poke, scaling, lane pressure, disengage) for every pair, reason-only rows marked editorial, sort by data or reason, partner role filter)
- [x] 25.4 Counterpick Matrix page: up to five pool champions × the role's 20 most common opponents, heatmap cells favourable / neutral / unfavourable / insufficient using `confidenceOf` (not raw win rate), with games in each cell, patch filter, and the best blind pick. Reuses pool coverage logic; the pool coverage panel links to it. Colour-blind safe and readable as a table. (9b67611; counterpick matrix page `?view=matrix` with up to five pool champions against the role's 20 most played opponents, cells judged by the 95% interval with marks, games per cell, current-patch toggle, best blind pick; linked from pool coverage)
- [x] 25.5 Difficulty breakdown on the champion page: mechanics, combos, positioning, skillshots, decisions, macro, consistency as qualitative levels (hand-kept, editorial badge), next to Data Dragon's official difficulty number (labelled official). (9b67611; seven areas as three levels for every champion (data/difficultyBreakdown.ts, editorial badge, coverage test) next to Data Dragon's number on the champion page)

## 26. Team preparation (D1–D3)

Builds on: the draft simulator (12.x, VZD1 codes, undo, Clash planner), composition analysis (`analyzeComp`, `compDimensions`, `teamDamage`, `teamCurve`, win conditions).

- [x] 26.1 Composition templates (wombo, protect the ADC, front-to-back, dive, poke, pick, split push, heavy engage, disengage, scaling, early pressure): objective, archetypes needed, roles, strengths, weaknesses, game phase, counter-comps; browse page with fitting champions from 25.1. (ac64d3a; 11 composition templates in data/compTemplates.json (needs as rules over traits and archetypes, strengths, weaknesses, phase, roles, counters) and a browse page `?view=templates` with fitting champions)
- [x] 26.2 Draft templates in the simulator: name, side, five picks, bans, notes, tags; save, duplicate, edit, delete, open in the simulator; codes reuse VZD1; stored under `vizier.drafts` (already exported). (9b67611; saved drafts in the simulator now carry side, tags and a note; search and tag filter; copy keeps them; codes stay VZD1 (side, tags and note are not in the code))
- [x] 26.3 Team Synergy Planner in the simulator and champ select: archetypes per pick, engage, disengage, frontline, CC, damage split, scaling, synergy pairs, and plain gap lines ("güvenilir engage az"). No overall score. (ac64d3a; team planner panel in the simulator (both sides) and champ select: archetype per pick, engage, disengage, front line, hard CC, scaling, damage split, synergy pairs, plain gap lines from four champions on, no score)
- [x] 26.4 Composition match: which template a team is closest to and what it still lacks, with the champions that would fill it from the player's pool first. (ac64d3a; closest two templates with met needs and the champions that would fill each missing one, pool picks first (marked with a star), inside the planner panel)

## 27. Draft Challenge and Quiz 2.0 (C2, C4)

Builds on: the quiz page and store (riddle modes, item game, timed mode, statistics), the simulator's analysis.

- [x] 27.1 Draft Challenge data model: scenario (both teams with unknown slots, role, question, choices or free champion pick, accepted answers with trade-offs, difficulty, category), stored as JSON with a schema test; the first 30 scenarios written by hand. (9b67611; scenario model with a validator and 30 hand-written scenarios in challenge/scenarios.json (Turkish and English, editorial), schema test)
- [x] 27.2 Draft Challenge page: play a scenario, answer, then the explanation with the alternatives that also work and why; session progress and replay; no win chances. (9b67611; draft challenge page `?view=challenge`: topic and difficulty filters, choices plus free pick, reasons and alternatives after the answer, summary, replay of missed scenarios)
- [x] 27.3 Generated scenarios from the composition rules (a team missing engage, all AP, heavy dive against it), with answers checked by the same rules, so the pool grows without hand writing. (ac64d3a; challenge/generate.ts builds scenarios for a missing starter, all-physical, all-magic and heavy dive; accepted and rejected lists are the rule's verdict on every champion that suits the role, so any pick is graded by the same rule; optional toggle on the challenge start screen)
- [x] 27.4 Quiz 2.0 categories in the existing quiz: abilities, item effects, runes, matchups (from crawler data with badge), compositions, synergies, roles, mechanics. Difficulty, timed and untimed, explanations after each answer, review and replay missed questions. Results stay in the session plus the existing local stats; no ranking. (f393168; exam tab in the quiz: 8 categories (abilities, item effects, runes, matchups with data badge, plans, pairs, roles, mechanics), easy/medium/hard (3/4/5 choices), optional 20 s timer, explanation after each answer, review and replay of missed questions; per-category totals in the local stats, no ranking)

## 28. Build history and checks (B2–B4)

Builds on: build docs (two newest patches kept), the library store and editors, pro builds (11.x), the patch tracker diffs.

- [x] 28.1 Build snapshots: the crawler keeps a compact per-patch summary of each champion/role build doc (items, runes, boots, skill order with games) when a patch closes, in a new table (backward compatible, small, written once per patch). Route `/v1/builds/history`. (f393168; crawler writes a compact build snapshot per champion and role once, when the newest patch has 300+ games and the second newest has none stored (migration 0016, local to the crawler); published as `buildhistory:` docs, served by `/v1/builds/history/:championId?position=`)
- [x] 28.2 Build Evolution view on the champion page: pick two patches, see items, runes, boots and skill order rising and falling with games; patches without a snapshot say so. (f393168; Build Evolution on the ranked champion page: pick two patches (the live build counts as one), items with share of own games, rising/falling/new/gone marks, boots, keystone and skill order; says so when fewer than two patches exist)
- [x] 28.3 Build Compatibility Checker in the library: removed or changed items and runes (against current Data Dragon), duplicate or incompatible items (one boots, one mythic-style uniques where they still exist), rune page rules, role mismatch, item order; suggestions shown, nothing changed without the player's OK. (f393168; Build check panel on a saved build: removed or unbuyable items, unknown runes, broken rune page, bad spells, repeated items, several boots, component listed after the item it builds into, rarely played role; fixes are offered one by one, nothing changes unasked (no mythic check: Data Dragon has no flag for it))
- [x] 28.4 Pro Build Timeline: each pro game's build as a timeline (items in buy order, runes, spells, skill order, opponent, patch, date), compare two pro builds, filter by player, team and patch, save to the library, open the champion. Only fields the pro data has. (f393168; Timeline view on the Pros page with the existing filters (group, team, player, champion, region, patch): start, buy order with finished items large, skill order, runes, spells, compare two games, save to library, open champion; buy times are not in the pro data so none are shown)

## 29. Personal workspace (E1–E3)

Builds on: `personal` (pool, favourites, followed pros, notes), the library, journal, local data export.

- [x] 29.1 Champion workspace tab on the champion page: my builds, my runes, matchup notes, favourite combos, saved pro builds, preferred role, tags, reminders, links. Reads the existing stores; no new profile. (439b4f7; Workspace tab on the champion page: builds, runes (from saved builds), saved pro builds, matchup notes, starred combos, preferred role, tags, reminders, web links)
- [x] 29.2 Favourites for every content type (builds, matchups, items, runes, pro builds, draft templates, composition templates, combos) with collections, tags, recently opened and search inside favourites; stored in `personal`. (439b4f7; favourites for builds, matchups, items, runes, pro, draft and composition templates and combos (stars on build, matchup, item, rune, template and combo; draft and pro stars not placed yet); Favourites page with collections, tags, recents and search)
- [x] 29.3 Data workspace in Settings: export and import builds, draft templates and notes separately or all at once, JSON with a version field; CSV for builds and notes. Import shows a preview with what is new, changed or skipped; validates schema, unknown champion and item ids, duplicates; never overwrites silently. (439b4f7; Settings: JSON export/import of builds, drafts and notes (versioned), CSV export of builds and notes, import preview with new/changed/same/skipped, unknown champion/item ids skipped, nothing overwritten)
- [x] 29.4 Local backups: automatic weekly backup of all local data to the app data folder (last 5 kept) and restore from the list. (439b4f7; weekly backup on start, last 5 kept, restore from the list in Settings; copies live in the webview storage next to the app data, outside exports)

## 30. Search 2.0 and Home 2.0 (F2, F3)

Builds on: the search palette (champions, pros, matchups, items, keystones, saved builds) and the customisable Home (14.3).

- [x] 30.1 Palette result types: abilities, draft templates, composition templates, combos, quiz categories, notes, archetypes, academy pages, the lab. (be22d56; palette finds abilities (one championFull fetch once 3+ letters are typed), team templates, combos, quiz categories, notes, archetypes, academy pages and lab directions)
- [x] 30.2 Intent searches: "anti tank build", "güçlü engage", "protect the carry", "Ahri combo" map to lab directions, archetypes, templates and combos (rules, tested; Turkish and English words). (be22d56; intent rules in search/intents.ts (tr/en phrases to lab directions, archetypes, templates; '<champion> combo'), tested)
- [x] 30.3 Recent searches, category tabs, suggestions on an empty query, full keyboard navigation. (be22d56; recent searches, category tabs for non-empty categories, suggestions on an empty query, Home/End/PageUp/PageDown and Ctrl or Alt + arrows for tabs)
- [x] 30.4 Home 2.0 cards: continue where you left off (recent champions, matchups, builds, drafts), favourites, saved templates, patch and meta changes, new pro builds, quick links to the lab, simulator and academy; all hideable and reorderable with the existing editor. No decorative charts. (be22d56; new Home cards: pick up where you left off (recent matchups, builds, drafts), favourites, quick links; existing patch, meta and pro cards cover the rest; all hideable and reorderable in the editor)

## 31. Overlay 2.0 polish (after epic 19)

- [x] 31.1 Overlay themes, transparency and scale per widget; settings preview uses the fixtures. (1b1659e; three colour themes, size and opacity sliders per widget in the overlay settings, preview follows them)
- [x] 31.2 Quick reference panels the player builds: pick any of build, runes, skill order, combo, matchup note, item info, and show them on a hotkey. (b9b5635; "Hızlı bakış" widget: build, runes, skill order, combo, matchup note, next item info in the order the player picks, on Ctrl+Shift+J; cargo test --lib green)
- [x] 31.3 Safe fallbacks: every widget shows a quiet empty state when Live Client data is missing or late, and the overlay never blocks the game when the API is down. Performance check: one render per second at most, measured in the fixture preview. (d659677; one render per second (pnpm perf:overlay measures 1.00/s in all four fixtures), a broken widget no longer takes the overlay down, opened panels with no data say so quietly; reference images regenerated)

---

# Data expansion: every rank, more data, more answers (owner's priority, 2026-11-10)

Until now the stats came from Emerald+ (TR, EUW) and KR Challenger only. From here on Vizier collects **all ranks, Iron to Challenger**, keeps Emerald+ as the default view, and lets the player pick a rank bracket everywhere. Epics 32–37 are data work and come first; 38–41 are the ideas the wider data makes possible. Rules for all of them:

- **Budget first.** The binding limits are the Riot key's rate (`RIOT_SHARE`, 70% per routing host) and D1's free 100k row writes a day (index writes count). Every slice that adds docs, rows or calls states its cost in the commit message and stays inside the budget test from 32.6. Nothing moves to a paid plan.
- **Backward compatible.** Every existing doc key, route and response shape keeps meaning exactly what it means today (Emerald+). Bracket data lives under new keys and an optional `?rank=` parameter; old app versions never see a change.
- **Crawler and rollup code** lives in `services/api/src` and runs on the VM over local SQLite (`services/crawler`). Local schema changes go in the crawler's own startup schema path; D1 migrations only when the Worker needs a new table. VM restarts, Worker deploys and remote migrations go to the Owner deploy queue, in the order they must run.
- **Rank of a game** is the tier of the seed player whose match list it came from (matchmaking keeps a lobby close in rank). The first seed that stores a match wins; never count a match twice.
- **Brackets** are stored per tier group: `iron_bronze`, `silver`, `gold`, `platinum`, `emerald`, `diamond`, `master_plus`. Published brackets are sums of groups: `all`, `gold_minus` (Iron–Gold), `platinum_plus`, `emerald_plus` (today's data, the default), `diamond_plus`, `master_plus`. Names and the summing live in one tested module used by the crawler, the Worker and the app.
- Thin buckets go through `confidenceOf` like everything else; a bracket too thin for a champion says so instead of silently falling back.

## 32. All-rank crawl

Builds on: `services/api/src/crawler.ts` (seeding, `DIVISION_PAGES`, `APEX_SAMPLE`, `crawl_players`), `services/crawler/src/main.ts` (`REGIONS`, `RUN_SIZE`, `RIOT_SHARE`), `rollup.ts`, `coverage.ts`.

- [ ] 32.1 Bracket module: tier groups, published brackets, `bracketOfTier(tier)`, `bracketsContaining(group)`, labels (tr/en), in a file both the API and the desktop app can import without pulling server code (if a shared package is needed, A17 starts here). Tests for every tier and every published bracket.
- [ ] 32.2 Stratified seeding: `leagues: "all"` seeds every tier from Iron to Challenger with a quota per group (default iron_bronze 10%, silver 14%, gold 16%, platinum 16%, emerald 16%, diamond 14%, master_plus 14%, in one tunable table). Division pages are picked at random page numbers inside each division (stop at the first empty page and remember the last page per division) so seeds spread across the ladder, not only its first 205 names. TR and EUW on the Europe host move to `all`; KR moves from Challenger to `all` with the same quotas. Tests with a fake Riot client: quotas met, empty pages handled, a failed page never wipes the pool.
- [ ] 32.3 Rank on every game: raw ranked rows get the seed's tier group (`rank_group`, nullable; old rows take the group of the seed tier they had). A match already stored from another seed keeps its first group. Tests for dedupe and the first-wins rule.
- [ ] 32.4 Call budget per host: the crawl spends its share by group quota (games per group per hour), skips match ids already stored before fetching them, and fetches timelines only for the share the timeline docs need (today's ranked timeline share for emerald+, a lower tunable share below). Hourly log line per group: seeds, games, timelines, calls. Tests for the quota scheduler.
- [ ] 32.5 Rollup by group: `stat_counts`, `lane_sums`, bench sums and item times gain the tier group as a key column (local SQLite), so every published bracket is a sum of groups. Emerald+ docs computed from `emerald + diamond + master_plus` must come out identical to the old path on a fixture (golden test).
- [ ] 32.6 Write budget test: from a fixture-sized rollup, count the docs each publish would send for every bracket and kind, multiply by the publish schedule, add index writes, and fail if the projected day goes over 70,000 D1 row writes. It prints the table so later slices see where the budget goes.
- [ ] 32.7 Coverage by bracket: `/v1/meta/coverage` gains games per bracket and per region (TR, EUW, KR) per patch and timeline share per bracket (new optional fields). The "Veriler nereden geliyor" section shows the bracket table with game counts.
- [ ] 32.8 Owner deploy steps written into the queue in order: local schema change on VM start, crawler pull and restart, first all-rank publish, Worker deploy, what to watch in the log in the first hour.

## 33. Bracket docs and the `?rank=` API

Builds on: `statDocs.ts` (`docKey`), `crawler/src/publish.ts` (changed docs only), `app.ts` routes, `cache.ts`.

- [ ] 33.1 Doc keys with a bracket suffix for every non-default bracket (`...:r=gold_minus`); `emerald_plus` keeps today's key. Kinds with bracket docs: tier lists, champion overview, build, counters, matchup builds, lane, bench, synergies. Item times, build history, augments and Arena stay unbracketed. Key round-trip tests.
- [ ] 33.2 Publish schedule per bracket: emerald_plus every 4 h as today; the other brackets once a day in rotation (one bracket per publish slot) so a day's writes stay inside the 32.6 budget. Changed-docs-only still applies. Budget test updated and green.
- [ ] 33.3 Routes take `?rank=` (`all`, `gold_minus`, `platinum_plus`, `emerald_plus`, `diamond_plus`, `master_plus`; unknown → 400; missing → emerald_plus). Responses gain `rank` next to `updatedAt`. Cache keys include the bracket. API tests per route.
- [ ] 33.4 `?region=` on tier lists and champion overview (`tr`, `euw`, `kr`; missing = pooled as today), published once a day for `emerald_plus` and `all` only. Budget test updated.
- [ ] 33.5 Rank curve docs: one small doc per queue with each champion and role's win rate, pick rate and games in every bracket side by side (`rankcurve:<queue>`), published once a day, for the elo views in 35.

## 34. Rank everywhere in the app

Builds on: the API client (`request<T>()`, per-route TTL cache, `useAsync`), the settings store, tier list, champion page, matchup page, champ select, overlay benchmark, loading screen scouting.

- [ ] 34.1 Rank filter: one `RankPicker` (the six brackets plus "Benim rankım") on every page that shows crawler stats; the choice is saved in settings, shown as a chip in the page header and passed as `?rank=` through the API client. Default stays Emerald+. Tests for the settings migration and query building.
- [ ] 34.2 "Benim rankım": read the player's solo queue tier from the LCU (typed Rust command over `/lol-ranked/v1/current-ranked-stats`, fixture test) and map it to the closest published bracket (Silver → gold_minus, Platinum → platinum_plus, Emerald → emerald_plus, ...). Unranked or client closed → Emerald+ with a note.
- [ ] 34.3 Tier list, champion page (header, builds, runes, counters, synergies) and matchup page follow the filter; every badge tooltip names the bracket. A value too thin in the bracket is greyed with the reason.
- [ ] 34.4 Champ select follows the player's bracket by default: pick suggestions, ban planner, hover advice, teammate picks and the imported build use it (setting "Şampiyon seçiminde kendi rankımın verisi", on). The import toast names the bracket the build came from.
- [ ] 34.5 Overlay benchmark and loading screen scouting compare against the player's bracket instead of Emerald+ when it has enough games; the widget says which bracket it uses.
- [ ] 34.6 Region filter (TR, EUW, KR, Hepsi) next to the rank filter on the tier list and champion page, from 33.4.

## 35. Elo views: what changes with rank

Builds on: 33.5 rank curve docs, tier list, champion page, the `dataviz` rules, `DataBadge`.

- [ ] 35.1 "Rank'a göre" panel on the champion page: win rate and pick rate per bracket as a small line chart with games under each point, and a plain line only when the change is outside the interval ("yüksek rankta daha iyi", "düşük rankta güçlü").
- [ ] 35.2 Elo explorer page (`?view=elo`): champions whose win rate rises or falls most from gold_minus to master_plus, per role, with games and badges; role and minimum games filters. Menu, palette and route as usual.
- [ ] 35.3 "Düşük elo dostu" and "Yüksek elo ödüllendirir" tags on tier list rows and in pool builder suggestions, only when the data supports them (interval rule from 22.2).
- [ ] 35.4 Queue view and autofill picks (21.2) use the player's bracket and prefer champions that are strong in it.

## 36. More from every game (new aggregate stats)

Builds on: raw ranked rows, timelines, `rollup.ts`, lane sums, item times, the champion page. Every new stat is bracketed like the rest and fits the budget test.

- [ ] 36.1 Win rate by game length: per champion and role, games and win rate in five buckets (<20, 20–25, 25–30, 30–35, 35+ min). Chart on the champion page; the draft phase curve (1.5) uses it when the data is thick enough and keeps the hand-kept curve as the labelled fallback.
- [ ] 36.2 Jungle paths: from timeline participant frames, the first camp side (topside or botside, by position at 1:30–2:00), the first lane visited after the clear (level 3–4 position near a lane) and the first gank minute, summed per jungler. Champion page "İlk tur" section with games per path. Tests on recorded frames.
- [ ] 36.3 Objectives per champion and role: team first dragon, first grubs or herald, first tower and first blood rates against the role average, with games. On the champion page, and "objektif gücü" tags where clear.
- [ ] 36.4 Item path tree: first, second and third completed item as a tree with win rate and games per branch (top 3 per level), from purchase order. Champion page build tab and the Itemization Lab's column picker.
- [ ] 36.5 Start and timing: most common starting items with win rate, and the median minute of boots and first completed item per champion and role (extends item times).
- [ ] 36.6 Builds of players who play the champion a lot: games from seeds with many games on it in the kept window (anonymised, no names, no profiles), summed as their own build doc with games. Shown as "Çok oynayanlar" next to the popular build when it differs.
- [ ] 36.7 Daily history: once a day a compact row per champion, role and bracket (win rate, pick rate, ban rate, games), kept for the two newest patches. Route `/v1/history/:championId`. Sparkline on the champion page header and tier list rows.

## 37. Data quality and trust

Builds on: rollup, coverage, `confidenceOf`, 22.x.

- [ ] 37.1 Leaver and remake filter: drop games that ended in early surrender or where a player left (`gameEndedInEarlySurrender`, AFK signs such as near-zero gold or damage), counted in coverage as dropped.
- [ ] 37.2 Role fix: when `teamPosition` is empty or two players share it, infer roles from Smite, items and timeline lane positions; fixture tests. Coverage counts how many games needed it.
- [ ] 37.3 Sanity checks on every rollup: average win rate of all champions near 50%, pick rates summing to 10 per game per bracket, no champion with more games than the patch total. A failing check holds the publish for that bracket and logs why.
- [ ] 37.4 New patch blending: in the first days of a patch, when a champion's new-patch sample is thin, show the previous patch labelled "geçen yama" instead of empty values, until the new sample passes the confidence rule.
- [ ] 37.5 Status card under About: last publish per bracket, games today, timeline share and any bracket held by 37.3, from coverage.

## 38. Stats Explorer

Builds on: tier list data, 33.x brackets, 36.x stats, the search palette.

- [ ] 38.1 Stats Explorer page (`?view=stats`): every champion and role in one sortable table with win rate, pick rate, ban rate, games, KDA, CS/min, gold diff at 15 and average game length; filters for role, rank, region and patch; a badge on every cell.
- [ ] 38.2 Column picker and saved views in settings, with three ready ones: lane bullies (gold diff at 15), late game (35+ win rate), ban targets.
- [ ] 38.3 Compare up to three champions side by side across every stat and bracket, opened from the explorer or the champion page.
- [ ] 38.4 Intent searches for the explorer ("en yüksek winrate jungle", "lane bully top") through the 30.2 intent rules.

## 39. Rising and falling

Builds on: 36.7 history, the patch tracker, Home 2.0 cards.

- [ ] 39.1 Movers: champions whose win rate or pick rate moved most within the patch (history plus the interval rule), per bracket. Home card and a tab on the tier list.
- [ ] 39.2 Patch impact: for each champion changed in the patch tracker's diff, win rate before and after with games once the new patch has enough data.
- [ ] 39.3 Pool notices: a quiet line on Home when a champion in the player's pool rose or fell clearly in their bracket.

## 40. Modes with more data

Builds on: `mode_players`, the ARAM, Mayhem and Arena docs. All-rank seeding brings far more mode players.

- [ ] 40.1 Mode player pool sized for all ranks: raise `MODE_PLAYERS_MAX` within the call budget, spread checks across the seed groups, report mode games per day in coverage.
- [ ] 40.2 ARAM win rate by game length (36.1 for ARAM) on the ARAM champion page and tier list.
- [ ] 40.3 Arena item win rates per champion behind the existing `ARENA_ITEMS` switch; budget test updated.
- [ ] 40.4 Mayhem augment pairs: the two augments that do best together on a champion (taken in the same game), top five per champion with games, behind `AUGMENTS`.

## 41. Smarter preparation from the new data

Builds on: champ select (epic 1), Matchup Academy (24), the lab (23).

- [ ] 41.1 Matchup page: lane gold and CS diff at 10 and 15 by bracket, and the matchup's win rate per game length bucket ("15. dakikaya kadar zor, sonra senin") when the data supports it.
- [ ] 41.2 Pick suggestions get a "senin rankında" reason line when bracket data changes the order compared with Emerald+.
- [ ] 41.3 Jungle paths from 36.2 in champ select: the player's jungler and the enemy jungler's most common first path, with games.
- [ ] 41.4 Item path tree (36.4) offered as an import choice in champ select ("en çok kazanan yol" or "en popüler").

## 42. Night ideas (built in the owner's local session, 2026-11-10)

Ideas the owner asked for on top of the data work: overlay, design and new tools. Built locally; the routines skip this epic.

- [x] 42.1 Overlay "Fırsat penceresi": dead enemies and allies with their respawn countdown (Live Client `isDead`, `respawnTimer`), and a plain line when the numbers open a window ("3 rakip ölü, 24 sn: Baron açık"). (dea6ebe; widget "Fırsat penceresi", Rust forwards isDead and respawnTimer)
- [x] 42.2 Overlay "Güç eşikleri": short notices when an enemy reaches level 6, 11 or 16 or completes an item, the lane opponent first. (dea6ebe; widget "Güç eşikleri", boots and components ignored)

## 16. Only when a feature needs it

Code health tasks. Do one only when a feature above depends on it.

- [x] A3 `request<T>()` with timeout, abort and one network retry. (c367dba)
- [x] A4 Per-route TTL cache for API answers. (d0150a6)
- [x] A5 `useAsync` stale-while-revalidate. (5d36863)
- [ ] A1 Split `App.css` per page.
- [ ] A6 Cache Data Dragon JSON per version in IndexedDB.
- [ ] A7 Versioned migrations for every local store.
- [ ] A17 `packages/shared` for types used by both the API and the desktop app.

---

## Owner deploy queue

Steps that need the owner's credentials or approval. Add to this list; don't run them.

Everything up to 0.8.6 is shipped (2026-11-10): D1 migrations through 0017 applied, Worker deployed, crawler pulled and restarted, `RIOT_KEY` set, desktop 0.8.6 released.

- Data expansion: once 32 and 33 are merged, run the steps 32.8 lists, in order. Until then the VM keeps crawling Emerald+ as before.
- Mayhem queue id: the probe on euw1 found no 2400/2401/2403/2405/2410/2450 games among Challenger players. Run it with the Riot ID of someone who plays Mayhem (`probeQueues.ts euw1 "Name#TAG"`), then trim `MAYHEM_QUEUES`.
- Check the lobby reading (epic 21) once against a live client.
- Optional: set `ARENA_ITEMS=off` on the Worker to hide Arena item stats; they are on by default.
