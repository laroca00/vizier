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
