import type { Champion } from "./data/ddragon";
import { fold } from "./fold";
import { parseMatchupQuery } from "./pages/matchupRoute";
import type { IconName } from "./ui/NavIcon";
import { comboQuery, intentTopics } from "./search/intents";
import type { Topic } from "./search/topics";

const SHOWN = 8;
const SHOWN_IN_TAB = 24;

export type PaletteLink = { id: string; label: string; icon: IconName };

export type Pro = { player: string; team: string };
/** An item, a keystone or a saved build: a name, an icon and what opens it. */
export type Entry = { id: string; name: string; icon: string | null };
export type Extras = { builds?: Entry[]; items?: Entry[]; runes?: Entry[]; topics?: Topic[] };

export type Result =
  | { kind: "page"; link: PaletteLink }
  | { kind: "champion"; champion: Champion }
  | { kind: "matchup"; a: Champion; b: Champion }
  | { kind: "pro"; pro: Pro }
  | { kind: "build"; entry: Entry }
  | { kind: "item"; entry: Entry }
  | { kind: "rune"; entry: Entry }
  | { kind: "topic"; topic: Topic; /** Found through a phrase like "anti tank" rather than by name. */ viaIntent?: boolean };

export const CATEGORIES = ["all", "champions", "pages", "builds", "items", "info", "notes", "pros"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_TEXT: Record<Category, string> = {
  all: "Hepsi",
  champions: "Şampiyonlar",
  pages: "Bölümler",
  builds: "Build ve kombolar",
  items: "Eşya ve rünler",
  info: "Bilgi",
  notes: "Notlar",
  pros: "Pro oyuncular",
};

/** The tab a result belongs under. */
export function categoryOf(result: Result): Exclude<Category, "all"> {
  switch (result.kind) {
    case "champion":
    case "matchup":
      return "champions";
    case "page":
      return "pages";
    case "build":
      return "builds";
    case "item":
    case "rune":
      return "items";
    case "pro":
      return "pros";
    case "topic":
      return result.topic.group === "note" ? "notes" : result.topic.group === "combo" ? "builds" : result.topic.group === "academy" || result.topic.group === "lab" ? "pages" : "info";
  }
}

/**
 * Names that start with the query come first. Matching pages lead, then
 * champions, the player's saved builds, items, keystones and pro players.
 */
export function search(query: string, list: Champion[], links: PaletteLink[], pros: Pro[] = [], extras: Extras = {}, category: Category = "all"): Result[] {
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
  const topics = extras.topics ?? [];
  const asked = comboQuery(query, list);
  const viaIntent = [
    ...(asked ? topics.filter((t) => t.group === "combo" && "champion" in t.target && t.target.champion === asked.key) : []),
    ...intentTopics(query, topics),
  ].map((topic) => ({ kind: "topic" as const, topic, viaIntent: true }));
  const named = topics
    .filter((t) => !viaIntent.some((r) => r.topic.id === t.id) && t.terms.some((term) => term.includes(needle)))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "tr"))
    .map((topic) => ({ kind: "topic" as const, topic }));
  const all: Result[] = [
    ...viaIntent,
    ...(versus ? [{ kind: "matchup" as const, ...versus }] : []),
    ...pages.map((link) => ({ kind: "page" as const, link })),
    ...(asked && !champs.includes(asked) ? [asked, ...champs] : champs).map((champion) => ({ kind: "champion" as const, champion })),
    ...entries("build", extras.builds),
    ...entries("item", extras.items),
    ...entries("rune", extras.runes),
    ...named,
    ...players.map((pro) => ({ kind: "pro" as const, pro })),
  ];
  return category === "all" ? all.slice(0, SHOWN) : all.filter((r) => categoryOf(r) === category).slice(0, SHOWN_IN_TAB);
}

