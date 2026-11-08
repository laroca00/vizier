import type { Picks, ProBuild } from "../api";
import type { BuildDraft, SavedBuild } from "./store";

// Turns recommended and pro builds into saved builds, and saved builds into
// what the client's importers take. Pure, so it is tested without a client.

const FLASH = 4;

/** Q, W and E in the order they reached five points; ones that never did follow by points spent. */
export function maxOrderOf(skillOrder: number[]): number[] {
  const points = [0, 0, 0, 0];
  const maxed: number[] = [];
  for (const slot of skillOrder) {
    if (slot < 1 || slot > 3) continue;
    points[slot] += 1;
    if (points[slot] === 5) maxed.push(slot);
  }
  const rest = [1, 2, 3].filter((s) => !maxed.includes(s)).sort((a, b) => points[b] - points[a]);
  return [...maxed, ...rest];
}

type Base = Pick<BuildDraft, "name" | "championId" | "position">;

export function fromPicks(base: Base, picks: Picks, finished: (id: number) => boolean): BuildDraft {
  const core = picks.coreItems?.ids ?? [];
  const page = picks.runes[0];
  const spells = picks.spells[0]?.ids ?? [FLASH, 14];
  return {
    ...base,
    runes: page ? { primaryStyle: page.primaryStyle, subStyle: page.subStyle, perks: [...page.perks] } : { primaryStyle: 8000, subStyle: 8100, perks: [] },
    spells: [spells[0] ?? FLASH, spells[1] ?? 14],
    startItems: picks.startItems?.ids ?? [],
    coreItems: core,
    items: picks.items.map((i) => i.id).filter((id) => finished(id) && !core.includes(id)).slice(0, 6),
    skillOrder: picks.skills?.maxOrder ?? [1, 2, 3],
    notes: "",
    collections: [],
    favourite: false,
    source: "stats",
  };
}

/** "primary:sub:p1,p2,p3,p4:s1,s2:offense,flex,defense", the API's pro rune key. */
export function parseRuneKey(key: string) {
  const [primary, sub, primaryPerks = "", subPerks = "", shards = ""] = key.split(":");
  return {
    primaryStyle: Number(primary),
    subStyle: Number(sub),
    perks: [primaryPerks, subPerks, shards].flatMap((group) => (group ? group.split(",").map(Number) : [])),
  };
}

export function fromPro(base: Base, pro: ProBuild, finished: (id: number) => boolean): BuildDraft {
  // The pro's buy order, finished items only.
  const bought = [...new Set(pro.purchases.filter(finished))];
  return {
    ...base,
    runes: parseRuneKey(pro.runes),
    spells: [pro.spells[0] ?? FLASH, pro.spells[1] ?? 14],
    startItems: pro.startItems,
    coreItems: bought.slice(0, 3),
    items: bought.slice(3, 6),
    skillOrder: pro.skillOrder.length ? maxOrderOf(pro.skillOrder) : [1, 2, 3],
    notes: "",
    collections: [],
    favourite: false,
    source: "pro",
  };
}

export type ExportLabels = { start: string; core: string; more: string };

/** The rune page and item set the client's importers take. */
export function toClient(build: BuildDraft, labels: ExportLabels) {
  const title = build.name.slice(0, 40) || "Vizier";
  return {
    page: {
      name: title,
      primaryStyleId: build.runes.primaryStyle,
      subStyleId: build.runes.subStyle,
      selectedPerkIds: build.runes.perks,
    },
    itemSet: {
      championId: build.championId,
      title,
      blocks: [
        ...(build.startItems.length ? [{ title: labels.start, items: build.startItems }] : []),
        ...(build.coreItems.length ? [{ title: labels.core, items: build.coreItems }] : []),
        ...(build.items.length ? [{ title: labels.more, items: build.items }] : []),
      ],
    },
    spells: build.spells,
  };
}

/** A rune page the client accepts: a keystone, three primary runes, two secondary and three shards. */
export function runesComplete(runes: SavedBuild["runes"]) {
  return runes.perks.length === 9 && runes.primaryStyle !== runes.subStyle && runes.perks.every((id) => id > 0);
}
