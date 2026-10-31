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

## Development

Requirements: Node 22+, pnpm, Rust (stable, MSVC toolchain) and the Visual Studio C++ Build Tools.

```sh
pnpm install
pnpm dev
```

### API service

`services/api` holds the Riot API key and is the only part of Vizier that talks to the Riot Web API. Copy `services/api/.env.example` to `services/api/.env`, add a key from the [Developer Portal](https://developer.riotgames.com), then:

```sh
pnpm api   # http://localhost:8787
pnpm test
```

## Legal

Vizier isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.

Code adapted from other projects and the bundled typeface are listed with their licenses in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
