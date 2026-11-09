import type { Item, ItemDetail, RuneStyle } from "../data/ddragon";
import { runeIssues, duplicateItems, type RuneIssue } from "./buildEdit";
import { RIFT_SPELLS } from "./data";
import type { SavedBuild } from "./store";

// Checks a saved build against today's Data Dragon and the usual rules of a
// build. It only reports and offers a fix; nothing changes until the player
// accepts one.

export type CompatKind =
  | "removed-item"
  | "unavailable-item"
  | "unknown-rune"
  | "rune-page"
  | "unknown-spell"
  | "duplicate-item"
  | "several-boots"
  | "component-after-item"
  | "role-mismatch";

export type Fix = (build: SavedBuild) => SavedBuild;

export type CompatIssue = {
  kind: CompatKind;
  /** Item, rune or spell ids the issue is about. */
  ids: number[];
  /** Turkish template and variables for the text; the panel translates it. */
  text: [template: string, vars?: Record<string, string | number>];
  /** What accepting the suggestion does; absent when the player has to decide. */
  fix?: { label: string; apply: Fix };
};

export type CompatData = {
  items: Map<number, Item>;
  details: Map<number, ItemDetail>;
  styles: Map<number, RuneStyle>;
  /** Roles a champion is played in with enough games; null when the tier lists could not be read. */
  rolesOf: ((championId: number) => string[]) | null;
};

const without = (ids: number[], drop: Set<number>) => ids.filter((id) => !drop.has(id));
const removeItems = (drop: number[]): Fix => (b) => {
  const set = new Set(drop);
  return { ...b, startItems: without(b.startItems, set), coreItems: without(b.coreItems, set), items: without(b.items, set) };
};

const RUNE_ISSUE_TEXT: Record<RuneIssue, string> = {
  "same-tree": "Ana ve ikincil rün ağacı aynı.",
  primary: "Ana ağaçta eksik rün var.",
  secondary: "İkincil ağaçta eksik rün var.",
  "secondary-rows": "İkincil rünler aynı satırdan; farklı satırlardan olmalı.",
  shards: "Parça rünlerinden biri eksik.",
  "wrong-tree": "Bir rün seçili ağaca ait değil.",
};

export function checkBuild(build: SavedBuild, data: CompatData): CompatIssue[] {
  const issues: CompatIssue[] = [];
  const listed = [...build.startItems, ...build.coreItems, ...build.items];

  const removed = [...new Set(listed.filter((id) => !data.items.has(id)))];
  if (removed.length > 0) issues.push({ kind: "removed-item", ids: removed, text: ["{count} eşya artık oyunda yok.", { count: removed.length }], fix: { label: "Kaldır", apply: removeItems(removed) } });

  // Items that exist but can no longer be bought on the Rift are changed or retired.
  const gone = [...new Set(listed.filter((id) => data.items.has(id) && data.details.size > 0 && data.details.get(id)?.gold.purchasable === false))];
  if (gone.length > 0) issues.push({ kind: "unavailable-item", ids: gone, text: ["{count} eşya artık satın alınamıyor.", { count: gone.length }], fix: { label: "Kaldır", apply: removeItems(gone) } });

  const known = new Set([...data.styles.values()].flatMap((s) => s.slots.flat().map((r) => r.id)));
  const styleIds = new Set(data.styles.keys());
  // Shard ids are not in the rune tree file; only the style ids and the tree runes are checked.
  const treePerks = build.runes.perks.slice(0, 6);
  const unknown = treePerks.filter((id) => id > 0 && !known.has(id));
  if (data.styles.size > 0 && (unknown.length > 0 || !styleIds.has(build.runes.primaryStyle) || !styleIds.has(build.runes.subStyle))) {
    issues.push({ kind: "unknown-rune", ids: unknown, text: ["Bazı rünler ya da ağaçlar artık yok; rün sayfasını yeniden seç."] });
  } else if (data.styles.size > 0) {
    for (const issue of runeIssues(build.runes, data.styles)) issues.push({ kind: "rune-page", ids: [], text: [RUNE_ISSUE_TEXT[issue]] });
  }

  const badSpells = build.spells.filter((id) => !RIFT_SPELLS.includes(id));
  if (badSpells.length > 0) issues.push({ kind: "unknown-spell", ids: badSpells, text: ["Büyü Çağrıcı büyülerinden biri Yarık'ta kullanılamıyor."] });

  const repeated = duplicateItems(build);
  if (repeated.length > 0) {
    issues.push({
      kind: "duplicate-item",
      ids: repeated,
      text: ["{count} eşya listede birden fazla kez var.", { count: repeated.length }],
      fix: {
        label: "Tekrarları kaldır",
        apply: (b) => {
          const seen = new Set<number>();
          const once = (ids: number[]) => ids.filter((id) => (seen.has(id) ? false : (seen.add(id), true)));
          return { ...b, coreItems: once(b.coreItems), items: once(b.items) };
        },
      },
    });
  }

  const boots = [...new Set([...build.coreItems, ...build.items].filter((id) => data.items.get(id)?.boots))];
  if (boots.length > 1) issues.push({ kind: "several-boots", ids: boots, text: ["Birden fazla bot var; yalnız biri kullanılabilir."] });

  // A component bought after the item it builds into is already part of that item.
  const order = [...build.coreItems, ...build.items];
  const parts = (id: number, seen = new Set<number>()): Set<number> => {
    for (const p of data.details.get(id)?.from ?? []) if (!seen.has(p)) parts(p, seen.add(p));
    return seen;
  };
  const stray = [...new Set(order.filter((id, i) => order.slice(0, i).some((earlier) => parts(earlier).has(id))))];
  if (stray.length > 0) issues.push({ kind: "component-after-item", ids: stray, text: ["{count} eşya, önceki bir eşyanın parçası; sırada gereksiz.", { count: stray.length }], fix: { label: "Kaldır", apply: removeItems(stray) } });

  if (build.position && data.rolesOf) {
    const roles = data.rolesOf(build.championId);
    if (roles.length > 0 && !roles.includes(build.position)) issues.push({ kind: "role-mismatch", ids: [], text: ["Bu şampiyon bu rolde seyrek oynanıyor; rol doğru mu?"] });
  }
  return issues;
}
