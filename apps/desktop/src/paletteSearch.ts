import type { Champion } from "./data/ddragon";
import { fold } from "./fold";
import { parseMatchupQuery } from "./pages/matchupRoute";
import type { IconName } from "./ui/NavIcon";

const SHOWN = 8;

export type PaletteLink = { id: string; label: string; icon: IconName };

export type Pro = { player: string; team: string };

export type Result =
  | { kind: "page"; link: PaletteLink }
  | { kind: "champion"; champion: Champion }
  | { kind: "matchup"; a: Champion; b: Champion }
  | { kind: "pro"; pro: Pro };

/** Names that start with the query come first; matching pages lead, pro players follow champions. */
export function search(query: string, list: Champion[], links: PaletteLink[], pros: Pro[] = []): Result[] {
  const needle = fold(query);
  if (!needle) return [];
  const versus = parseMatchupQuery(query, list);
  const rank = (name: string) => Number(!fold(name).startsWith(needle));
  const pages = links.filter((l) => fold(l.label).includes(needle)).sort((a, b) => rank(a.label) - rank(b.label));
  const champs = list
    .filter((c) => fold(c.name).includes(needle))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "tr"));
  const players = pros.filter((p) => fold(p.player).includes(needle)).sort((a, b) => rank(a.player) - rank(b.player) || a.player.localeCompare(b.player));
  return [
    ...(versus ? [{ kind: "matchup" as const, ...versus }] : []),
    ...pages.map((link) => ({ kind: "page" as const, link })),
    ...champs.map((champion) => ({ kind: "champion" as const, champion })),
    ...players.map((pro) => ({ kind: "pro" as const, pro })),
  ].slice(0, SHOWN);
}

