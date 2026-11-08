# Riot policy review

Reviewed on 2026-11-07 against:

- [General policies](https://developer.riotgames.com/policies/general), last updated 29 May 2025.
- [League of Legends docs](https://developer.riotgames.com/docs/lol): Game Integrity, Approved and Unapproved Use Cases, League Client API, Game Client API. The page shows no date.
- Riot's 2026-10-06 change that blocks game memory access for unapproved apps (recorded in `.claude/skills/riot-policy-check`).

Policies change. Re-read both pages before shipping anything that runs in a game or touches the client.

## Rules that decide most cases

Quoted from the pages above:

- "Products must not use or incorporate information not present in the game client that would give players a competitive edge (e.g., automatically or manually allowing tracking enemy ultimate cooldowns), especially when such data is not already accessible through regular gameplay."
- Unapproved: "Products may not provide any game-session-specific information that would be previously unknown to the player."
- Unapproved: "Apps that dictate player decisions." The general policy adds that products "may highlight decisions that are important and give multiple choices".
- Approved: "Game overlays that provide static data that is available prior to the game."
- "Products cannot display win rates for Augments or Arena Mode items. This applies to all websites, applications and overlays."
- "Products cannot identify or analyze players who are deliberately hidden by the game."
- "Products cannot create alternatives for official skill ranking systems such as the ranked ladder."
- "You may not place advertisements in Riot properties, which include in-game, loading screens, and the Riot Client."
- League Client API: "This service is not officially supported for use with third party applications". Riot wants to know which endpoints a product uses, through its Developer Portal registration.

Neither page covers objective timers, jungle timers, manual timers, in-game item or skill suggestions as such, or rank lookups in the loading screen. Those cases are judged against the rules above and default to the conservative choice.

## Features

Status values: permitted, restricted (allowed only in the form described), uncertain (not built until Riot confirms), prohibited.

| Feature | Data and API | Status | Safeguards | Riot approval |
|---|---|---|---|---|
| Tier lists, builds, counters, synergies, ban rates | Riot Web API (match-v5, league-v4) through our crawler; aggregates only, no player identities | Permitted ("Aggregate player stats (no specific players)") | Crawled games keep no names or PUUIDs in published stats; the sample size is shown | None beyond registration |
| Champion Select build, runes, spells, item preview | LCU champ select session, our stats, Data Dragon | Permitted | The local player only; ally and enemy names are dropped in `lcu/champ_select.rs` | Declare the LCU endpoints in the portal |
| Rune, spell and item set import | LCU writes (`lol-perks`, `lol-champ-select` spells, `lol-item-sets`) | Permitted in practice; the docs don't mention LCU writes | Reuses the Vizier rune page, never replaces presets, asks before replacing a player page, keeps other item sets; each import can be switched off | Declare the endpoints in the portal |
| Matchup guide, composition analysis | Public champ select picks, Data Dragon tags and info, our aggregates | Permitted | Only champions already visible in champ select; general advice, no prediction of hidden picks | None |
| Pro Builds | Riot Web API for known pro and Challenger accounts | Permitted, with care | Builds and public names only; filters by player, team, region and patch over finished games; no live tracking of a pro's current game | None |
| Build Library, personal builds, collections | Local data, our aggregates, Data Dragon | Permitted | No account; stored locally | None |
| Champion database | Data Dragon (and CommunityDragon for missing assets) | Permitted | Only values Data Dragon publishes; nothing invented | None |
| Draft simulator | Data Dragon, our aggregates | Permitted | No win probability; the page says so | None |
| Patch tracker | Data Dragon version diffs; links to Riot's patch notes | Permitted | Notes are linked, not scraped or copied | None |
| Overlay: custom timer and stopwatch | User input only | Permitted | No game data | None |
| Overlay: quick notes, rune page reference, ability reference, item lookup | Local notes, the player's own rune page, Data Dragon | Permitted ("static data that is available prior to the game") | Read only, nothing about other players | None |
| Overlay: build reference (the chosen build's items and skill order) | Pre-game build data; the player's own items from the Live Client Data API to tick off what is done | Restricted | Shows the build the player chose as a checklist, not an instruction; no "buy now" or timing prompts | None if kept in this form |
| Overlay: skill to level next | Pre-game skill order and the player's own level from the Live Client Data API | Uncertain, close to "dictate player decisions" | Still in the app until the owner's overlay redesign; reword as a static skill-order reference or drop then | Ask Riot if kept |
| Overlay: objective respawn timers (dragon, baron, inhibitors) | Live Client Data API event feed | Uncertain | Still in the app until the overlay redesign; the game shows its own objective timers | Ask Riot |
| Overlay: manual jungle camp timers | User key presses | Uncertain; the manual tracking example in Game Integrity is about enemy ultimates, but the reasoning is similar | Still in the app until the overlay redesign | Ask Riot |
| Overlay: item gold difference and scoreboard difference | Live Client Data API (items visible on the scoreboard) and Data Dragon prices | Uncertain; the items are visible in game, the computed difference is not | Still in the app until the overlay redesign | Ask Riot if kept |
| Overlay: benchmarks, pace, coach goal | Live Client Data API, our aggregates | Removed by product decision | Deleted in Phase 1 | Not applicable |
| Loading screen scouting (ranks, mastery of all ten players) | Spectator-v5, league-v4, champion-mastery-v4 | Removed by product decision; policy unclear for named players | Deleted in Phase 1 | Not applicable |
| Arena and ARAM Mayhem augment pick and win rates | Our aggregates | Prohibited without written approval | Shown since 2026-11-08 by the owner's decision after asking Riot, before a written answer. The Worker serves them only while `AUGMENTS` is `on` in `wrangler.jsonc`; setting it to `off` and deploying hides them for every installed copy at once | Written approval through the Developer Portal; switch off if Riot objects |
| Post-game coach, profiles, dashboard, LP history | Riot Web API, Workers AI, Anthropic | Permitted by policy ("Post-game analysis", "Showing (self) player stats") but removed by product decision | Deleted in Phase 1 | Not applicable |
| Game memory reading or writing | None | Prohibited | Not used anywhere; only the LCU, the Live Client Data API, the Riot Web API and Data Dragon | Not applicable |

## Product obligations

- Register Vizier on the Developer Portal before opening it to other players, and declare the LCU endpoints it uses. A production key needs a working prototype and a description of the user flows. One product per key.
- The Riot key stays on the crawler's server. Neither the Worker nor the desktop app holds it.
- A free tier must exist. Ads are not allowed in the overlay or on the loading screen.
- Show the legal boilerplate in the README, the About screen and any website footer: "Vizier isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc."
- Publish custom game match history only with the player's opt-in. Vizier publishes none today.

## Open questions for Riot

1. Objective respawn timers and manual jungle camp timers in an overlay.
2. Showing the next step of the player's own chosen skill order during the game.
3. Arena and ARAM Mayhem augment win rates. The owner asked Riot and turned them on before a written answer; switch them off if Riot says no.
