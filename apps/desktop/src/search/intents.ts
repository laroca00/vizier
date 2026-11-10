import { fold } from "../fold";
import type { Champion } from "../data/ddragon";
import type { Topic } from "./topics";

// Short phrases people type when they know what they want but not what it is
// called. Each rule lists folded fragments (Turkish and English) and the topics
// it points to; fragments are matched anywhere in the folded query.

type Rule = { words: string[]; topics: string[] };

const RULES: Rule[] = [
  { words: ["antitank", "tankakarsi", "tanklarakarsi", "zirhdelici", "armorpen"], topics: ["lab:anti-tank"] },
  { words: ["engage", "baslatici", "girisci", "dalis"], topics: ["archetype:engagesup", "archetype:diver", "template:heavyEngage", "template:dive"] },
  { words: ["protectthecarry", "carrykoru", "tasiciyikoru", "korumaci", "enchanter"], topics: ["template:protect", "archetype:enchanter"] },
  { words: ["poke", "durtme"], topics: ["lab:poke", "template:poke", "archetype:artillery"] },
  { words: ["burst", "patlama"], topics: ["lab:burst", "archetype:burstmage", "archetype:assassin"] },
  { words: ["sustain", "cancalma", "yenilenme", "dayaniklilik"], topics: ["lab:sustain"] },
  { words: ["defensive", "savunma", "tankbuild"], topics: ["lab:defensive", "archetype:juggernaut"] },
  { words: ["disengage", "geriitme", "uzaklastir"], topics: ["template:disengage"] },
  { words: ["splitpush", "yankoridor", "splitter"], topics: ["template:split", "archetype:splitpusher"] },
  { words: ["scaling", "gecoyun", "latecarry", "hypercarry"], topics: ["template:scaling", "archetype:hypercarry"] },
  { words: ["earlypressure", "erkenbaski", "erkenoyun"], topics: ["template:earlyPressure", "archetype:lanebully"] },
  { words: ["wombo"], topics: ["template:wombo"] },
  { words: ["pickkomp", "yakalama", "catch"], topics: ["template:pick", "archetype:catcher"] },
].map((r) => ({ ...r, words: r.words.map(fold) }));

/** The topic a phrase points to, in rule order and without repeats. */
export function intentTopics(query: string, topics: Topic[]): Topic[] {
  const needle = fold(query);
  if (needle.length < 4) return [];
  const byId = new Map(topics.map((t) => [t.id, t]));
  const found: Topic[] = [];
  for (const rule of RULES) {
    if (!rule.words.some((w) => needle.includes(w))) continue;
    for (const id of rule.topics) {
      const topic = byId.get(id);
      if (topic && !found.includes(topic)) found.push(topic);
    }
  }
  return found;
}

/** "Ahri combo" or "ahri kombo": the champion named before the word, or null. */
export function comboQuery(query: string, champions: Champion[]): Champion | null {
  const needle = fold(query);
  const word = ["combos", "combo", "kombolari", "kombosu", "kombo"].find((w) => needle.endsWith(w));
  if (!word) return null;
  const name = needle.slice(0, needle.length - word.length);
  return name ? (champions.find((c) => fold(c.name) === name) ?? null) : null;
}

const word = (text: string) => text.toLocaleLowerCase("tr").split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(fold);

// Words that name a stat of the explorer; a stat is found when any of its words is a whole word of the query.
const STAT_WORDS: [string, string[]][] = [
  ["goldDiff15", ["bully", "bullies", "golddiff", "goldlead", "ezen", "ezenler"]],
  ["lateWinRate", ["lategame", "gecoyun"]],
  ["winRate", ["winrate", "kazanma", "kazanmaorani", "galibiyet", "wr"]],
  ["pickRate", ["pickrate", "secilme", "populer", "popular"]],
  ["banRate", ["banrate", "yasaklanma", "yasak", "ban", "banned"]],
  ["kda", ["kda"]],
  ["csPerMinute", ["cs", "csdk", "farm", "csmin"]],
  ["minutes", ["sure", "suresi", "length", "duration"]],
];
const ROLE_WORDS: [string, string[]][] = [
  ["TOP", ["top", "ust", "toplane", "ustkoridor"]],
  ["JUNGLE", ["jungle", "jungler", "jg", "orman", "ormanci"]],
  ["MIDDLE", ["mid", "middle", "orta", "midlane"]],
  ["BOTTOM", ["adc", "bot", "bottom", "alt", "nisanci"]],
  ["UTILITY", ["support", "sup", "destek", "utility"]],
];
const LOW_WORDS = ["lowest", "worst", "least", "dusuk", "endusuk", "az", "enaz"];

/**
 * "en yüksek winrate jungle", "lane bully top", "lowest kda support": the table
 * of the stats explorer that answers it, or null when the phrase names no stat.
 * Multi-word stats ("lane bully", "late game", "gold diff") are joined first.
 */
export function statsIntent(query: string, topics: Topic[]): Topic | null {
  const raw = word(query);
  if (raw.length === 0) return null;
  const tokens = [...raw];
  for (let i = 0; i < raw.length - 1; i++) tokens.push(raw[i] + raw[i + 1]);
  const stat = STAT_WORDS.find(([, words]) => words.some((w) => tokens.includes(w)))?.[0];
  if (!stat) return null;
  const role = ROLE_WORDS.find(([, words]) => words.some((w) => raw.includes(w)))?.[0] ?? "ALL";
  const asc = raw.some((w) => LOW_WORDS.includes(w)) || tokens.includes("endusuk") || tokens.includes("enaz");
  // A lone stat word is too common to hijack the results; it needs a role, a direction or another word.
  if (raw.length < 2 && !asc) return null;
  const id = `stats:${stat}:${role}:${asc ? "asc" : "desc"}`;
  return topics.find((t) => t.id === id) ?? null;
}
