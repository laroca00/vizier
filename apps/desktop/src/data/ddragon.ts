const BASE = "https://ddragon.leagueoflegends.com";

export type Champion = {
  id: string;
  key: number;
  name: string;
  /** Deals mostly magic damage, by Data Dragon's ratings; the API reads enemy teams the same way. */
  magic: boolean;
  tank: boolean;
  /** Data Dragon's classes, main one first: "Fighter", "Mage", ... */
  tags: string[];
  /** Data Dragon's 0-10 ratings. */
  info: { attack: number; defense: number; magic: number; difficulty: number };
  /** The resource bar, as Data Dragon names it in Turkish: "Mana", "Enerji", "Yok"... */
  partype?: string;
  /** Basic attack range at level one. */
  attackRange?: number;
  /** Level-one stats from champion.json, for comparing champions at a glance. */
  baseStats?: { hp: number; armor: number; mr: number; ad: number; speed: number };
};

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
    .then(
      (response) =>
        response.json() as Promise<{
          data: Record<
            string,
            { id: string; key: string; name: string; tags: string[]; info: Champion["info"]; partype?: string; stats?: { attackrange?: number; hp?: number; armor?: number; spellblock?: number; attackdamage?: number; movespeed?: number } }
          >;
        }>,
    )
    .then(
      ({ data }) =>
        new Map(
          Object.values(data).map((c) => [
            Number(c.key),
            {
              id: c.id,
              key: Number(c.key),
              name: c.name,
              magic: c.info.magic > c.info.attack,
              tank: c.tags[0] === "Tank",
              tags: c.tags,
              info: c.info,
              partype: c.partype,
              attackRange: c.stats?.attackrange,
              baseStats:
                c.stats?.hp !== undefined
                  ? { hp: c.stats.hp, armor: c.stats.armor ?? 0, mr: c.stats.spellblock ?? 0, ad: c.stats.attackdamage ?? 0, speed: c.stats.movespeed ?? 0 }
                  : undefined,
            },
          ]),
        ),
    );
  return championsByKey;
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

export type Item = { id: number; name: string; complete: boolean; gold: number; boots?: boolean };

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
              boots: !!item.tags?.includes("Boots"),
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

export function splashUrl(championId: string, skin = 0) {
  return `${BASE}/cdn/img/champion/splash/${championId}_${skin}.jpg`;
}

export function loadingUrl(championId: string, skin = 0) {
  return `${BASE}/cdn/img/champion/loading/${championId}_${skin}.jpg`;
}

/** Data Dragon names the base skin "default". */
export function skinLabel(skin: Skin, championName: string) {
  return skin.name === "default" ? championName : skin.name;
}

export type Skin = { num: number; name: string };

const skinsById = new Map<string, Promise<Skin[]>>();

/** The champion's skins with their own splash; chromas share their parent's art. */
export function skins(championId: string): Promise<Skin[]> {
  let list = skinsById.get(championId);
  if (!list) {
    list = latestVersion()
      .then((v) => fetch(`${BASE}/cdn/${v}/data/tr_TR/champion/${championId}.json`))
      .then((response) => response.json() as Promise<{ data: Record<string, { skins: (Skin & { parentSkin?: number })[] }> }>)
      .then(({ data }) => data[championId].skins.filter((skin) => skin.parentSkin === undefined));
    skinsById.set(championId, list);
  }
  return list;
}

export type Ability = {
  key: "P" | "Q" | "W" | "E" | "R";
  name: string;
  /** Plain text; Data Dragon's markup is stripped. */
  description: string;
  /** Seconds per rank; empty for the passive. */
  cooldowns: number[];
  image: string;
  /** Resource cost per rank, and what it is paid in ("Mana", "Energy"...); empty for the passive. */
  costs?: number[];
  costType?: string;
  /** Range per rank; Data Dragon uses 25000 for abilities without one. */
  ranges?: number[];
};

export type ChampionDetail = {
  title: string;
  lore: string;
  /** The champion's resource, "Mana", "Energy" and so on, in the UI language. */
  resource: string;
  /** Data Dragon's base stats: hp, hpperlevel, armor, attackrange, movespeed and so on. */
  stats: Record<string, number>;
  abilities: Ability[];
  allyTips: string[];
  enemyTips: string[];
};

const detailsByKey = new Map<string, Promise<ChampionDetail>>();

const plain = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();

type RawSpell = { name: string; description: string; cooldown?: number[]; cost?: number[]; costType?: string; range?: number[]; image: { full: string } };

/** Abilities and Riot's own tips in the UI language; tips are empty for some newer champions. */
export function championDetail(championId: string, lang: "tr" | "en"): Promise<ChampionDetail> {
  const key = `${lang}:${championId}`;
  let detail = detailsByKey.get(key);
  if (!detail) {
    detail = latestVersion()
      .then((v) => fetch(`${BASE}/cdn/${v}/data/${lang === "tr" ? "tr_TR" : "en_GB"}/champion/${championId}.json`))
      .then(
        (response) =>
          response.json() as Promise<{
            data: Record<
              string,
              {
                title: string;
                lore: string;
                partype: string;
                stats: Record<string, number>;
                passive: RawSpell;
                spells: RawSpell[];
                allytips: string[];
                enemytips: string[];
              }
            >;
          }>,
      )
      .then(({ data }) => {
        const c = data[championId];
        const keys = ["Q", "W", "E", "R"] as const;
        return {
          title: c.title,
          lore: plain(c.lore),
          resource: c.partype,
          stats: c.stats,
          abilities: [
            { key: "P" as const, name: c.passive.name, description: plain(c.passive.description), cooldowns: [], image: `passive/${c.passive.image.full}` },
            ...c.spells.map((s, i) => ({ key: keys[i], name: s.name, description: plain(s.description), cooldowns: s.cooldown ?? [], image: `spell/${s.image.full}`, costs: s.cost ?? [], costType: s.costType, ranges: s.range ?? [] })),
          ],
          allyTips: c.allytips.map(plain),
          enemyTips: c.enemytips.map(plain),
        };
      });
    detailsByKey.set(key, detail);
    detail.catch(() => detailsByKey.delete(key));
  }
  return detail;
}

export function abilityIconUrl(version: string, image: string) {
  return `${BASE}/cdn/${version}/img/${image}`;
}

export function loadingArtUrl(championId: string) {
  return `${BASE}/cdn/img/champion/loading/${championId}_0.jpg`;
}

const ROLE_ICONS: Record<string, string> = { TOP: "top", JUNGLE: "jungle", MIDDLE: "middle", BOTTOM: "bottom", UTILITY: "utility" };

export function roleIconUrl(position: string) {
  const role = ROLE_ICONS[position.toUpperCase()] ?? "fill";
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions/icon-position-${role}.png`;
}
