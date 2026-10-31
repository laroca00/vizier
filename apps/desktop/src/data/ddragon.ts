const BASE = "https://ddragon.leagueoflegends.com";

export type Champion = { id: string; key: number; name: string };

let version: Promise<string> | undefined;
let championsByKey: Promise<Map<number, Champion>> | undefined;

/** The newest patch on Data Dragon; fetched once per session. */
export function latestVersion(): Promise<string> {
  version ??= fetch(`${BASE}/api/versions.json`)
    .then((response) => response.json() as Promise<string[]>)
    .then((versions) => versions[0]);
  return version;
}

/** Champions keyed by the numeric id the LCU and match-v5 use. */
export function champions(): Promise<Map<number, Champion>> {
  championsByKey ??= latestVersion()
    .then((v) => fetch(`${BASE}/cdn/${v}/data/tr_TR/champion.json`))
    .then((response) => response.json() as Promise<{ data: Record<string, { id: string; key: string; name: string }> }>)
    .then(({ data }) => new Map(Object.values(data).map((c) => [Number(c.key), { id: c.id, key: Number(c.key), name: c.name }])));
  return championsByKey;
}

export function profileIconUrl(version: string, iconId: number) {
  return `${BASE}/cdn/${version}/img/profileicon/${iconId}.png`;
}

export function championIconUrl(version: string, championId: string) {
  return `${BASE}/cdn/${version}/img/champion/${championId}.png`;
}

export type SummonerSpell = { id: string; key: number; name: string };

let spellsByKey: Promise<Map<number, SummonerSpell>> | undefined;

export function summonerSpells(): Promise<Map<number, SummonerSpell>> {
  spellsByKey ??= latestVersion()
    .then((v) => fetch(`${BASE}/cdn/${v}/data/tr_TR/summoner.json`))
    .then((response) => response.json() as Promise<{ data: Record<string, { id: string; key: string; name: string }> }>)
    .then(({ data }) => new Map(Object.values(data).map((s) => [Number(s.key), { id: s.id, key: Number(s.key), name: s.name }])));
  return spellsByKey;
}

export function spellIconUrl(version: string, spellId: string) {
  return `${BASE}/cdn/${version}/img/spell/${spellId}.png`;
}

export type Rune = { id: number; name: string; icon: string };
export type RuneStyle = Rune & { slots: Rune[][] };

let runeStyles: Promise<Map<number, RuneStyle>> | undefined;

export function runes(): Promise<Map<number, RuneStyle>> {
  runeStyles ??= latestVersion()
    .then((v) => fetch(`${BASE}/cdn/${v}/data/tr_TR/runesReforged.json`))
    .then((response) => response.json() as Promise<{ id: number; name: string; icon: string; slots: { runes: Rune[] }[] }[]>)
    .then((styles) => new Map(styles.map((s) => [s.id, { id: s.id, name: s.name, icon: s.icon, slots: s.slots.map((slot) => slot.runes) }])));
  return runeStyles;
}

/** Rune and style icons are not versioned. */
export function runeIconUrl(icon: string) {
  return `${BASE}/cdn/img/${icon}`;
}

export type Item = { id: number; name: string; complete: boolean; gold: number };

let itemsById: Promise<Map<number, Item>> | undefined;

type RawItem = { name: string; into?: string[]; tags?: string[]; gold: { total: number }; consumed?: boolean };

export function items(): Promise<Map<number, Item>> {
  itemsById ??= latestVersion()
    .then((v) => fetch(`${BASE}/cdn/${v}/data/tr_TR/item.json`))
    .then((response) => response.json() as Promise<{ data: Record<string, RawItem> }>)
    .then(
      ({ data }) =>
        new Map(
          Object.entries(data).map(([id, item]) => [
            Number(id),
            {
              id: Number(id),
              name: item.name,
              gold: item.gold.total,
              // Nothing builds out of it and it isn't used up: a finished item.
              complete:
                !item.into?.length && !item.consumed && !item.tags?.includes("Trinket") && item.gold.total >= 900,
            },
          ]),
        ),
    );
  return itemsById;
}

export function itemIconUrl(version: string, itemId: number) {
  return `${BASE}/cdn/${version}/img/item/${itemId}.png`;
}
