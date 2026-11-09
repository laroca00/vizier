import { championIconUrl, itemIconUrl, runeIconUrl, spellIconUrl, splashUrl } from "../data/ddragon";
import { skillOrderLabel, type LibraryData } from "./data";
import type { SavedBuild } from "./store";

export type Icon = { src: string; label: string };

/** What a shared build picture holds, resolved to names and icon addresses. */
export type CardContent = {
  title: string;
  subtitle: string;
  portrait: string | null;
  splash: string | null;
  keystone: Icon | null;
  primary: Icon[];
  secondary: Icon[];
  spells: Icon[];
  /** Item rows; `main` marks the core, drawn a step larger. */
  rows: { label: string; items: Icon[]; main?: boolean }[];
  skills: string | null;
};

type T = (text: string, params?: Record<string, string | number>) => string;

/**
 * The parts of a build that go on its picture. Anything the current Data
 * Dragon no longer knows (a removed item, an old rune) is left off instead of
 * drawn as a hole. Notes stay private, as they do in share codes.
 */
export function cardContent(build: SavedBuild, data: LibraryData, t: T, roleName: (position: string) => string | null): CardContent {
  const champion = data.champions.get(build.championId);
  const rune = (id: number): Icon | null => {
    const r = data.runes.get(id);
    return r ? { src: runeIconUrl(r.icon), label: r.name } : null;
  };
  const known = (list: (Icon | null)[]) => list.filter((x): x is Icon => x !== null);
  const item = (id: number): Icon | null => {
    const i = data.items.get(id);
    return i ? { src: itemIconUrl(data.version, id), label: i.name } : null;
  };
  const [keystone, ...rest] = build.runes.perks;
  const rows = [
    { label: t("Başlangıç"), items: known(build.startItems.map(item)) },
    { label: t("Çekirdek"), items: known(build.coreItems.map(item)), main: true },
    { label: t("Sonra"), items: known(build.items.map(item)) },
  ].filter((row) => row.items.length > 0);
  return {
    title: build.name,
    subtitle: [champion?.name, build.position ? roleName(build.position) : t("Her rol")].filter(Boolean).join(", "),
    portrait: champion ? championIconUrl(data.version, champion.id) : null,
    splash: champion ? splashUrl(champion.id) : null,
    keystone: keystone ? rune(keystone) : null,
    primary: known(rest.slice(0, 3).map(rune)),
    secondary: known(rest.slice(3, 5).map(rune)),
    spells: known(
      build.spells.map((id) => {
        const s = data.spells.get(id);
        return s ? { src: spellIconUrl(data.version, s.id), label: s.name } : null;
      }),
    ),
    rows,
    skills: build.skillOrder.length > 0 ? skillOrderLabel(build.skillOrder) : null,
  };
}
