# Vizier

A lightweight League of Legends companion for Windows, for preparing games rather than grading them.

- Champion select: the build for your pick with style and matchup tabs, pro players' builds against the same or a similar opponent, a lane opponent guess, pick suggestions, a matchup guide and both teams' composition. Runes, summoner spells and item sets go into the client on their own or with a click.
- Build library: search every champion's recommended build by role, style, keystone and item, and keep your own builds in collections.
- Champions: the full list with roles and difficulty, a page per champion with stats, abilities, lore and base stats, and a champion pool of main and backup picks.
- Pro builds from Worlds players, Turkish pros and the Challenger ladders, filtered by champion, team, player, region and patch.
- A draft simulator with bans and pick suggestions, and a patch tracker that compares any two recent Data Dragon versions.
- A daily champion riddle in four modes: classic, ability, emoji and skin.
- Arena and ARAM Mayhem augments by tier, pick rate and win rate, overall or per champion.

Your own builds, drafts, pool and notes stay on your computer.

Early development. The plan is in [docs/IMPLEMENTATION_ROADMAP.md](docs/IMPLEMENTATION_ROADMAP.md).

## How it works

Vizier only uses the interfaces Riot exposes to third-party apps:

- The League Client API (local) for champion select, rune pages and item sets.
- The Live Client Data API (local, port 2999) for in-game data the player can already see.
- The Riot Web API for match data. Only our crawler calls it, so the API key never ships with the app.
- Data Dragon for champion, item and rune data.

It never reads or writes game memory.

## Install

The first install is manual; after that Vizier updates itself. Build the installer with `pnpm build`. It lands in `apps/desktop/src-tauri/target/release/bundle/nsis/Vizier_<version>_x64-setup.exe` (an MSI is built next to it under `bundle/msi/`).

## Releasing an update

Bump `version` in `apps/desktop/src-tauri/tauri.conf.json`, then run `pnpm release "what changed"`. The script builds an installer signed with the key in `~/.tauri/vizier.key`, which stays out of the repo; without it no update can be published. It uploads the installer and `latest.json` to the API Worker's KV store, where installed apps look for updates.

## Development

Requirements: Node 22+, pnpm, Rust (stable, MSVC toolchain) and the Visual Studio C++ Build Tools.

```sh
pnpm install
pnpm dev
pnpm --filter @vizier/desktop test   # desktop logic and translation checks
pnpm --filter @vizier/desktop lint
```

### API service

`services/api` serves the stats the crawler publishes (tier lists, builds, counters, synergies, pro builds) and the desktop app's updates. It runs on Cloudflare Workers with a D1 database and makes no Riot calls itself. `services/crawler` is the part that holds the Riot API key; its README covers the server it runs on.

```sh
pnpm --filter @vizier/api db:migrate   # local D1
pnpm api                               # http://localhost:8787
pnpm test
```

First deploy:

```sh
cd services/api
npx wrangler login
npx wrangler d1 create vizier          # put the printed database_id in wrangler.jsonc
pnpm db:migrate:remote
pnpm deploy
```

Product scope and Riot policy notes live in [docs/](docs/).

## Legal

Vizier isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

Code adapted from other projects and the bundled typeface are listed with their licenses in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
