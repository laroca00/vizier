# Backlog

The work after `IMPLEMENTATION_ROADMAP.md` (phases 0–11 are done). This list is about features a player sees: new tools and real improvements to the existing pages. Code health work only happens when a feature needs it.

Product scope: prepare, explore, customize. No post-game analysis, coaching or personal performance tracking (aggregate stats from the crawler are fine). The in-game overlay's design belongs to the owner; don't redesign it.

## How to work through this file

- Epics are in priority order. Inside an epic, slices are in order.
- **One run is one job: the next 4–5 unchecked slices of the highest epic that isn't blocked**, built together as one feature on one branch (`auto/<epic>-<topic>`), one commit per slice. If the epic has fewer slices left, take the rest of it plus the start of the next epic. Don't stop after a single slice; a run should be long, finishing the whole job, and then start the next job if time is left.
- Merge the branch into main when the whole job is done and green. If time runs out mid-job, merge the slices that are finished and green, and leave a `<!-- in progress: ... -->` line under the next slice saying where you stopped.
- Mark each slice `[x]` with the merge commit hash when it lands, e.g. `- [x] 3.2 ... (a1b2c3d)`. (949d3b2; the rollup pairs Arena players by subteam, docs `duos:1700:<champion>`, route `/v1/arena/duos/:championId`)
- Don't split slices into smaller ones unless one is genuinely too big for a run.
- A slice that can't be done (missing data, needs a live client, needs an owner decision) gets `[-]` and one line saying why. Move on.
- Every slice ends with `pnpm --filter @vizier/desktop test`, `pnpm --filter @vizier/desktop lint` and `pnpm build:web` passing; API and crawler slices also run `pnpm --filter @vizier/api test`.
- File names must differ by more than case: Windows resolves `./banPlanner` and `./BanPlanner` to the same file. Name the component `BanPlannerPanel.tsx` next to the logic in `banPlanner.ts`.
- New logic gets Vitest tests. New Turkish strings get an English entry in `i18n.en.ts`. UI copy is short and plain.
- Every number shown to a player comes with its game count. Hide or grey out values with too few games instead of showing noise.
- New pages: add the route in `router.ts`, a lazy import in `App.tsx`, a menu entry in `Sidebar.tsx`, an entry in the search palette, and a `?view=` id for dev.
- Champ select work can't be tested against a real client in the cloud. Build it against recorded session fixtures (epic 1.1 adds the mock) and keep the LCU calls behind the existing Rust commands.
- Anything that needs a Worker deploy, a remote D1 migration or a VM restart must stay backward compatible; add the step to "Owner deploy queue" at the bottom instead of running it.

---

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
- [x] 3.2 Arena duo helper: in Arena champ select, show the partner's champion and suggest picks that pair well (from Arena games where both champions were on the same team; needs a crawler rollup of duo pairs for queue 1700, backward compatible).
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
- [ ] 9.6 Share codes v2: shorter codes that still read v1; pasting a code anywhere in the app offers to open it.
- [ ] 9.7 Build diff between two saved builds.
- [x] 9.8 Search the build index by item ("who builds Rabadon's") and keystone. (fddc671; the build explorer already filtered by item and keystone; no new work)

## 10. Queue and lobby companion

- [ ] 10.1 LCU gameflow phases (lobby, matchmaking, ready check) in the frontend state; Rust tests with recorded events.
- [ ] 10.2 Queue view: while in queue, show the selected roles' pool champions with their current tier, a patch change badge and their saved build, plus "if you get autofilled" picks for the other roles (easiest high win rate champions).
- [ ] 10.3 Ready check: optional sound and taskbar flash when a match is found (setting, off by default).
- [ ] 10.4 Lobby: when the player sets roles, preload the data champ select will need so it opens instantly.

## 11. Pro play

Worlds and pro builds are a top priority for the EUW audience.

- [ ] 11.1 Pro player pages: recent games, most played champions, usual runes and items, team and region.
- [ ] 11.2 Pro meta page: most picked and banned champions in pro games this patch, by role, with their win rate in pro games.
- [ ] 11.3 Followed pros on Home: their newest games.
- [ ] 11.4 Pro games on the champion page and matchup page, same opponent first.
- [ ] 11.5 Save any pro build to the library in one click from every view.
- [ ] 11.6 More pro accounts: LCK, LPL, LEC and LCS players whose solo queue accounts are public, with name-matching tests.

## 12. Draft simulator improvements

- [ ] 12.1 Load the current champ select into the simulator.
- [ ] 12.2 Share a draft as text and as a code; import from a code.
- [ ] 12.3 Undo and redo.
- [ ] 12.4 The new champ select analysis in the simulator: damage profile, phase curve, win conditions, threats (epics 1.3–1.7).
- [ ] 12.5 Keyboard flow: type to search, Enter to pick into the selected slot, Tab to the next slot.
- [ ] 12.6 Clash planner: up to five players with their pools saved locally; the simulator suggests a draft that uses each player's pool and covers the team's needs.

## 13. Patch tracker improvements

- [ ] 13.1 Per-level stat changes shown at level 1 and level 18, not only the raw growth number.
- [ ] 13.2 Ability cooldown and cost changes per rank, item recipe and build path changes.
- [ ] 13.3 Buff / nerf / mixed label per champion and item from simple rules.
- [ ] 13.4 Pool champions first and a Home badge when one changed.
- [ ] 13.5 Win rate before and after the patch for each changed champion (uses 6.2).
- [ ] 13.6 A champion's change history over the cached versions on its page.

## 14. Home

- [ ] 14.1 "This patch for you" card: pool champions' tier, win rate change and patch changes in one glance.
- [ ] 14.2 Meta movers card (6.5) and followed pros card (11.3).
- [ ] 14.3 Customisable Home: show, hide and reorder cards; saved in settings.
- [ ] 14.4 Search palette: items, runes, pro players, saved builds and "X vs Y" matchups as result types.

## 15. Riddle and fun

- [ ] 15.1 Item recipe mode: guess the item from its components.
- [ ] 15.2 Ability icon mode with rotation and greyscale difficulty steps.
- [ ] 15.3 Stats page: streaks, guess distribution, history per mode.
- [ ] 15.4 Item game timed mode with a local best score.

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

- Release a desktop version (`pnpm release`) after bumping the patch version.
- Deploy the Worker (`pnpm --filter @vizier/api deploy`).
- Apply pending D1 migrations remotely.
- Pull and restart the crawler on the VM (Arena duo and item docs appear after the next rollup and publish; duo counts start from games crawled after the update).
- Apply D1 migration 0013 (lane stats) remotely before the next crawler run on the VM; lane docs fill as timelines are crawled.
- After the Worker and crawler update, the build docs gain `perks`, `perkGames` and `skillOptions` on the next publish; single-rune counts only cover games rolled up after the crawler update.
- Apply D1 migration 0014 (item completion times) remotely before the next crawler run on the VM; times fill as timelines are crawled.
- Optional: set `ARENA_ITEMS=off` on the Worker to hide Arena item stats; they are on by default.
