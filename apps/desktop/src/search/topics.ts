import { DEFAULT_STATS_VIEW, type StatsColumn } from "../data/statsTable";
import { ARCHETYPES } from "../data/archetypes";
import { COMP_TEMPLATES } from "../data/compTemplates";
import { combosOf } from "../data/combos";
import type { Champion } from "../data/ddragon";
import { fold } from "../fold";
import { journalEntries, parseNoteKey } from "../journalNotes";
import { DIRECTIONS } from "../lab/directions";
import type { Route } from "../router";

// Things that are not a champion, build, item or keystone but still worth
// finding by name: team plans, archetypes, lab directions, quiz categories,
// notes, combos and abilities. They open the page that shows them.

export type TopicGroup = "archetype" | "template" | "lab" | "quiz" | "academy" | "combo" | "note" | "ability";
export type Target = { route: Route } | { champion: number };

export type Topic = {
  id: string;
  group: TopicGroup;
  /** Shown in the result. */
  name: string;
  /** Folded words the topic is found by, in both languages. */
  terms: string[];
  target: Target;
};

type Lang = "tr" | "en";

const QUIZ: { id: string; tr: string; en: string }[] = [
  { id: "classic", tr: "Klasik", en: "Classic" },
  { id: "ability", tr: "Yetenek", en: "Ability" },
  { id: "emoji", tr: "Emoji", en: "Emoji" },
  { id: "skin", tr: "Kostüm", en: "Skin" },
  { id: "item", tr: "Eşya", en: "Item" },
  { id: "recipe", tr: "Tarif", en: "Recipe" },
];

// The academy pages are sections already, but people search for them by what they do.
const ACADEMY: { id: string; tr: string; en: string; words: string[]; route: Route }[] = [
  { id: "matchup", tr: "Eşleşme çalışması", en: "Matchup study", words: ["matchup", "akademi", "academy", "lane"], route: { page: "matchup", championId: null, opponentId: null, position: "MIDDLE" } },
  { id: "matrix", tr: "Karşı seçim matrisi", en: "Counterpick matrix", words: ["counter", "matrix", "matris", "karsi secim"], route: { page: "matrix", position: "MIDDLE" } },
  { id: "stats", tr: "İstatistik gezgini", en: "Stats explorer", words: ["stats", "istatistik", "tablo", "table", "kda", "cs", "winrate", "altin farki", "gold diff"], route: { page: "stats", ...DEFAULT_STATS_VIEW } },
  { id: "compare", tr: "Karşılaştır", en: "Compare champions", words: ["compare", "karsilastir", "yan yana", "versus", "vs"], route: { page: "compare", picks: [] } },
  { id: "elo", tr: "Elo gezgini", en: "Elo explorer", words: ["elo", "rank", "lig", "yuksek elo", "dusuk elo", "high elo", "low elo"], route: { page: "elo", position: "ALL", minGames: 500 } },
  { id: "synergy", tr: "Sinerji gezgini", en: "Synergy explorer", words: ["synergy", "sinerji", "duo"], route: { page: "synergy", championId: null, position: "MIDDLE" } },
  { id: "challenge", tr: "Draft meydan okuması", en: "Draft challenge", words: ["draft", "challenge", "meydan okuma"], route: { page: "challenge" } },
];

const STAT_NAMES: Record<string, { tr: string; en: string }> = {
  winRate: { tr: "kazanma oranı", en: "win rate" },
  pickRate: { tr: "seçilme oranı", en: "pick rate" },
  banRate: { tr: "yasaklanma oranı", en: "ban rate" },
  kda: { tr: "KDA", en: "KDA" },
  csPerMinute: { tr: "CS/dk", en: "CS/min" },
  goldDiff15: { tr: "15. dk altın farkı", en: "gold diff at 15" },
  lateWinRate: { tr: "geç oyun kazanma", en: "late-game win rate" },
  minutes: { tr: "oyun süresi", en: "game length" },
};
const ROLE_NAMES: Record<string, { tr: string; en: string }> = {
  ALL: { tr: "Tüm roller", en: "All roles" },
  TOP: { tr: "Üst", en: "Top" },
  JUNGLE: { tr: "Orman", en: "Jungle" },
  MIDDLE: { tr: "Orta", en: "Mid" },
  BOTTOM: { tr: "Alt", en: "Bot" },
  UTILITY: { tr: "Destek", en: "Support" },
};

/**
 * "Orman · en yüksek kazanma oranı": a ready table of the stats explorer for
 * every stat, role and direction. They have no search terms of their own and
 * are only found through the phrases in intents.ts.
 */
export function statsTopics(lang: Lang): Topic[] {
  return Object.keys(STAT_NAMES).flatMap((stat) =>
    Object.keys(ROLE_NAMES).flatMap((position) =>
      (["desc", "asc"] as const).map((dir): Topic => ({
        id: `stats:${stat}:${position}:${dir}`,
        group: "academy",
        name: `${ROLE_NAMES[position][lang]} · ${dir === "desc" ? (lang === "tr" ? "en yüksek" : "highest") : lang === "tr" ? "en düşük" : "lowest"} ${STAT_NAMES[stat][lang]}`,
        terms: [],
        target: { route: { page: "stats", ...DEFAULT_STATS_VIEW, position, sort: stat as StatsColumn, desc: dir === "desc" } },
      })),
    ),
  );
}

const terms = (...words: string[]) => words.map(fold).filter(Boolean);

/** The topics that need no network and no player data. */
export function staticTopics(lang: Lang): Topic[] {
  return [
    ...ARCHETYPES.map((a): Topic => ({ id: `archetype:${a.id}`, group: "archetype", name: a.name[lang], terms: terms(a.name.tr, a.name.en), target: { route: { page: "archetypes" } } })),
    ...COMP_TEMPLATES.map((t): Topic => ({ id: `template:${t.id}`, group: "template", name: t.name[lang], terms: terms(t.name.tr, t.name.en), target: { route: { page: "templates" } } })),
    ...DIRECTIONS.map((d): Topic => ({ id: `lab:${d.id}`, group: "lab", name: d.label, terms: terms(d.label, d.id.replace("-", " ")), target: { route: { page: "lab", championId: null, position: "MIDDLE" } } })),
    ...QUIZ.map((q): Topic => ({ id: `quiz:${q.id}`, group: "quiz", name: q[lang], terms: terms(q.tr, q.en), target: { route: { page: "quiz" } } })),
    ...statsTopics(lang),
    ...ACADEMY.map((a): Topic => ({ id: `academy:${a.id}`, group: "academy", name: a[lang], terms: terms(a.tr, a.en, ...a.words), target: { route: a.route } })),
  ];
}

/** Every written combo as "Champion · combo name"; found by either word. */
export function comboTopics(champions: Champion[], lang: Lang): Topic[] {
  return champions.flatMap((champion) =>
    combosOf(champion.id).map(
      (combo): Topic => ({ id: `combo:${champion.id}/${combo.id}`, group: "combo", name: `${champion.name} · ${combo.name[lang]}`, terms: terms(champion.name, combo.name.tr, combo.name.en), target: { champion: champion.key } }),
    ),
  );
}

/** The player's own notes, found by their text; matchup notes open the journal. */
export function noteTopics(notes: Record<string, string>, nameOf: (id: number) => string): Topic[] {
  return journalEntries(notes).map((entry): Topic => {
    const parsed = parseNoteKey(entry.key);
    const subject = !parsed ? entry.key : parsed.opponentId ? `${nameOf(parsed.championId)} – ${nameOf(parsed.opponentId)}` : nameOf(parsed.championId);
    return {
      id: `note:${entry.key}`,
      group: "note",
      name: subject,
      terms: terms(subject, entry.text.slice(0, 300)),
      target: parsed && !parsed.opponentId ? { champion: parsed.championId } : { route: { page: "journal" } },
    };
  });
}
