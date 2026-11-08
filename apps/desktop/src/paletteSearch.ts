import type { Champion } from "./data/ddragon";
import { fold } from "./fold";
import { parseMatchupQuery } from "./pages/matchupRoute";
import type { IconName } from "./ui/NavIcon";

const SHOWN = 8;

export type PaletteLink = { id: string; label: string; icon: IconName };

export type Pro = { player: string; team: string };
/** An item, a keystone or a saved build: a name, an icon and what opens it. */
export type Entry = { id: string; name: string; icon: string | null };
export type Extras = { builds?: Entry[]; items?: Entry[]; runes?: Entry[] };

export type Result =
  | { kind: "page"; link: PaletteLink }
  | { kind: "champion"; champion: Champion }
  | { kind: "matchup"; a: Champion; b: Champion }
  | { kind: "pro"; pro: Pro }
  | { kind: "build"; entry: Entry }
  | { kind: "item"; entry: Entry }
  | { kind: "rune"; entry: Entry };

/**
 * Names that start with the query come first. Matching pages lead, then
 * champions, the player's saved builds, items, keystones and pro players.
 */
export function search(query: string, list: Champion[], links: PaletteLink[], pros: Pro[] = [], extras: Extras = {}): Result[] {
  const needle = fold(query);
  if (!needle) return [];
  const versus = parseMatchupQuery(query, list);
  const rank = (name: string) => Number(!fold(name).startsWith(needle));
  const pages = links.filter((l) => fold(l.label).includes(needle)).sort((a, b) => rank(a.label) - rank(b.label));
  const champs = list
    .filter((c) => fold(c.name).includes(needle))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "tr"));
  const players = pros.filter((p) => fold(p.player).includes(needle)).sort((a, b) => rank(a.player) - rank(b.player) || a.player.localeCompare(b.player));
  const entries = <K extends "build" | "item" | "rune">(kind: K, list: Entry[] = []) =>
    list
      .filter((e) => fold(e.name).includes(needle))
      .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "tr"))
      .map((entry) => ({ kind, entry }) as Extract<Result, { kind: K }>);
  return [
    ...(versus ? [{ kind: "matchup" as const, ...versus }] : []),
    ...pages.map((link) => ({ kind: "page" as const, link })),
    ...champs.map((champion) => ({ kind: "champion" as const, champion })),
    ...entries("build", extras.builds),
    ...entries("item", extras.items),
    ...entries("rune", extras.runes),
    ...players.map((pro) => ({ kind: "pro" as const, pro })),
  ].slice(0, SHOWN);
}

