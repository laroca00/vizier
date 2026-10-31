# Vizier

A lightweight League of Legends companion for Windows. Vizier imports runes, summoner spells and item sets during champion select, and breaks down your games once they're over.

Early development. Nothing usable yet.

## How it works

Vizier only uses the interfaces Riot exposes to third-party apps:

- **League Client API** (local) for champion select, rune pages and item sets
- **Live Client Data API** (local, port 2999) for in-game data the player can already see
- **Riot Web API** for accounts, ranks and match history, called from our own backend so the API key never ships with the app
- **Data Dragon** for champion, item and rune data

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
```

### API service

`services/api` holds the Riot API key and is the only part of Vizier that talks to the Riot Web API. It runs on Cloudflare Workers with a D1 database.

Local run: copy `services/api/.dev.vars.example` to `services/api/.dev.vars` and add a key from the [Developer Portal](https://developer.riotgames.com).

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
npx wrangler secret put RIOT_API_KEY
pnpm deploy
```

Post-game coaching is free: rules find the issues in a match and Workers AI rewords them within its free daily allocation; if the rewrite changes any number, the rule wording is served instead. Claude can take over for chosen accounts by setting `ANTHROPIC_API_KEY` and `COACH_PUUIDS` (comma-separated PUUIDs); that path costs money per analysis and is capped at 20 a day.

## Legal

Vizier isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

Code adapted from other projects and the bundled typeface are listed with their licenses in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
