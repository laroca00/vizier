import type { Counters, TierEntry } from "../api";
import { COMP_TEMPLATES } from "../data/compTemplates";
import { cellState } from "../counterMatrix";
import type { Champion, Item, ItemDetail, RuneStyle } from "../data/ddragon";
import { STAT_PRICES } from "../data/itemGold";
import { SYNERGY_CATEGORIES, SYNERGY_TEXT, synergyReasons } from "../data/synergyReasons";
import { POSITIONS } from "../labels";

// Multiple-choice questions built from the app's own data. Prompts and
// explanations are Turkish templates with variables so the page can translate
// them; choices are names that already come in the player's language.

export const EXAM_CATEGORIES = ["abilities", "items", "runes", "matchups", "comps", "synergies", "roles", "mechanics"] as const;
export type ExamCategory = (typeof EXAM_CATEGORIES)[number];

export const EXAM_CATEGORY_TEXT: Record<ExamCategory, string> = {
  abilities: "Yetenekler",
  items: "Eşya etkileri",
  runes: "Rünler",
  matchups: "Eşleşmeler",
  comps: "Kompozisyonlar",
  synergies: "Sinerjiler",
  roles: "Roller",
  mechanics: "Mekanikler",
};

export type Phrase = [template: string, vars?: Record<string, string | number>];

export type Question = {
  id: string;
  category: ExamCategory;
  difficulty: 1 | 2 | 3;
  prompt: Phrase;
  choices: string[];
  answer: number;
  explain: Phrase;
  /** Crawler numbers behind the answer, for a data badge; absent for editorial or Data Dragon questions. */
  sample?: { games: number; winRate: number };
};

export type Context = {
  champions: Champion[];
  roles: Map<number, Map<string, TierEntry>>;
  items: Map<number, Item>;
  itemDetails: Map<number, ItemDetail>;
  runes: Map<number, RuneStyle>;
  abilityNames: (champion: Champion) => Promise<string[]>;
  counters: (championId: number, role: string) => Promise<Counters | null>;
  /** Translates a Turkish app string into the UI language. */
  t: (text: string) => string;
  lang: "tr" | "en";
};

export const CHOICES: Record<1 | 2 | 3, number> = { 1: 3, 2: 4, 3: 5 };

type Rng = () => number;

export function shuffle<T>(list: T[], rng: Rng): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const pickOne = <T>(list: T[], rng: Rng): T | undefined => list[Math.floor(rng() * list.length)];

/** The right answer among wrong ones, shuffled; null when the wrong pool is too small. */
export function withChoices(correct: string, wrong: string[], count: number, rng: Rng): { choices: string[]; answer: number } | null {
  const others = shuffle([...new Set(wrong)].filter((w) => w !== correct), rng).slice(0, count - 1);
  if (others.length < count - 1) return null;
  const choices = shuffle([correct, ...others], rng);
  return { choices, answer: choices.indexOf(correct) };
}

type Generator = (ctx: Context, difficulty: 1 | 2 | 3, rng: Rng) => Promise<Omit<Question, "id" | "category" | "difficulty"> | null>;

const GENERATORS: Record<ExamCategory, Generator> = {
  async abilities(ctx, d, rng) {
    const champion = pickOne(ctx.champions, rng);
    if (!champion) return null;
    const names = (await ctx.abilityNames(champion)).filter(Boolean);
    const ability = pickOne(names, rng);
    if (!ability) return null;
    const c = withChoices(champion.name, ctx.champions.map((x) => x.name), CHOICES[d], rng);
    return c && { prompt: ["«{ability}» yeteneği hangi şampiyona ait?", { ability }], ...c, explain: ["{ability}, {champion} şampiyonunun yeteneği.", { ability, champion: champion.name }] };
  },

  async items(ctx, d, rng) {
    const finished = [...ctx.itemDetails.values()].filter((i) => ctx.items.get(i.id)?.complete && Object.keys(i.stats).some((k) => STAT_PRICES[k]));
    const item = pickOne(finished, rng);
    if (!item) return null;
    // Ask about the stat the item gives most of, by the price table's own weighing.
    const own = Object.keys(item.stats).filter((k) => STAT_PRICES[k]);
    const key = [...own].sort((a, b) => item.stats[b] * STAT_PRICES[b].gold - item.stats[a] * STAT_PRICES[a].gold)[0];
    const label = ctx.t(STAT_PRICES[key].label);
    const ownLabels = new Set(own.map((k) => ctx.t(STAT_PRICES[k].label)));
    const c = withChoices(label, Object.values(STAT_PRICES).map((p) => ctx.t(p.label)).filter((l) => !ownLabels.has(l)), CHOICES[d], rng);
    return c && { prompt: ["{item} hangi istatistiği en çok verir?", { item: item.name }], ...c, explain: ["{item} en çok «{stat}» verir.", { item: item.name, stat: label }] };
  },

  async runes(ctx, d, rng) {
    const styles = [...ctx.runes.values()];
    const style = pickOne(styles, rng);
    const rune = style && pickOne(style.slots.flat(), rng);
    if (!style || !rune) return null;
    const c = withChoices(style.name, styles.map((s) => s.name), Math.min(CHOICES[d], styles.length), rng);
    return c && { prompt: ["{rune} hangi rün ağacında?", { rune: rune.name }], ...c, explain: ["{rune}, {tree} ağacında.", { rune: rune.name, tree: style.name }] };
  },

  async matchups(ctx, d, rng) {
    const champion = pickOne(shuffle(ctx.champions, rng).filter((c) => ctx.roles.has(c.key)), rng);
    if (!champion) return null;
    const roles = [...(ctx.roles.get(champion.key) ?? [])].sort((a, b) => b[1].games - a[1].games);
    const role = roles[0]?.[0];
    if (!role) return null;
    const doc = await ctx.counters(champion.key, role);
    if (!doc) return null;
    const name = (id: number) => ctx.champions.find((c) => c.key === id)?.name;
    const cells = doc.matchups.map((m) => ({ ...m, name: name(m.championId), state: cellState(m.games, m.winRate) })).filter((m) => m.name);
    const good = cells.filter((m) => m.state === "favourable").sort((a, b) => b.games - a.games)[0];
    const bad = cells.filter((m) => m.state === "unfavourable").map((m) => m.name!);
    if (!good) return null;
    const c = withChoices(good.name!, bad, CHOICES[d], rng);
    return (
      c && {
        prompt: ["{champion} ({role}) hangisine karşı daha rahat?", { champion: champion.name, role: ctx.t(POSITIONS[role] ?? role) }],
        ...c,
        explain: ["{champion}, {opponent} karşısında {rate} kazanıyor ({games} maç).", { champion: champion.name, opponent: good.name!, rate: `%${(good.winRate * 100).toFixed(1)}`, games: good.games }],
        sample: { games: good.games, winRate: good.winRate },
      }
    );
  },

  async comps(ctx, d, rng) {
    const template = pickOne(COMP_TEMPLATES, rng)!;
    const c = withChoices(template.name[ctx.lang], COMP_TEMPLATES.map((t) => t.name[ctx.lang]), Math.min(CHOICES[d], COMP_TEMPLATES.length), rng);
    return c && { prompt: ["Hangi takım planının hedefi: «{objective}»?", { objective: template.objective[ctx.lang] }], ...c, explain: ["{plan}: {objective}", { plan: template.name[ctx.lang], objective: template.objective[ctx.lang] }] };
  },

  async synergies(ctx, d, rng) {
    const a = pickOne(ctx.champions, rng);
    const reason = pickOne(SYNERGY_CATEGORIES, rng);
    if (!a || !reason) return null;
    const others = ctx.champions.filter((c) => c.key !== a.key);
    const fits = others.filter((c) => synergyReasons(a, c).includes(reason));
    const misses = others.filter((c) => synergyReasons(a, c).length === 0);
    const right = pickOne(fits, rng);
    if (!right) return null;
    const c = withChoices(right.name, misses.map((m) => m.name), CHOICES[d], rng);
    return c && { prompt: ["{champion} ile «{reason}» açısından kim uyumlu?", { champion: a.name, reason: ctx.t(SYNERGY_TEXT[reason].name) }], ...c, explain: ["{reason}", { reason: ctx.t(SYNERGY_TEXT[reason].reason) }] };
  },

  async roles(ctx, d, rng) {
    const champion = pickOne(ctx.champions.filter((c) => (ctx.roles.get(c.key)?.size ?? 0) >= 1), rng);
    if (!champion) return null;
    const played = [...(ctx.roles.get(champion.key) ?? [])].sort((a, b) => b[1].pickRate - a[1].pickRate);
    const [role, top] = played[0];
    // A clear main role only: the runner-up must be well behind.
    if (played[1] && played[1][1].pickRate > top.pickRate * 0.6) return null;
    const c = withChoices(ctx.t(POSITIONS[role]), Object.values(POSITIONS).map(ctx.t), Math.min(CHOICES[d], 5), rng);
    return c && { prompt: ["{champion} en çok hangi rolde oynanıyor?", { champion: champion.name }], ...c, explain: ["{champion} en çok {role} rolünde oynanıyor ({games} maç).", { champion: champion.name, role: ctx.t(POSITIONS[role]), games: top.games }] };
  },

  async mechanics(ctx, d, rng) {
    if (rng() < 0.5) {
      const withResource = ctx.champions.filter((c) => c.partype);
      const champion = pickOne(withResource, rng);
      if (!champion) return null;
      const c = withChoices(champion.partype!, withResource.map((x) => x.partype!), Math.min(CHOICES[d], 4), rng);
      return c && { prompt: ["{champion} hangi kaynağı kullanır?", { champion: champion.name }], ...c, explain: ["{champion} kaynak olarak «{resource}» kullanır.", { champion: champion.name, resource: champion.partype! }] };
    }
    const ranged = ctx.champions.filter((c) => (c.attackRange ?? 0) > 0);
    const group = shuffle(ranged, rng).slice(0, CHOICES[d]);
    const longest = [...group].sort((a, b) => (b.attackRange ?? 0) - (a.attackRange ?? 0));
    if (group.length < CHOICES[d] || (longest[0].attackRange ?? 0) === (longest[1].attackRange ?? 0)) return null;
    const choices = group.map((c) => c.name);
    return { prompt: ["Hangisinin temel saldırı menzili en uzun?"], choices, answer: choices.indexOf(longest[0].name), explain: ["{champion} {range} menzille en uzun olanı.", { champion: longest[0].name, range: longest[0].attackRange! }] };
  },
};

const TRIES = 20;

/** Up to `count` questions; categories rotate when "all" is asked. Questions a category cannot make are skipped. */
export async function buildExam(
  category: ExamCategory | "all",
  difficulty: 1 | 2 | 3,
  count: number,
  ctx: Context,
  rng: Rng = Math.random,
): Promise<Question[]> {
  const out: Question[] = [];
  const kinds = category === "all" ? shuffle([...EXAM_CATEGORIES], rng) : [category];
  let misses = 0;
  for (let i = 0; out.length < count && misses < count * TRIES; i++) {
    const kind = kinds[i % kinds.length];
    const made = await GENERATORS[kind](ctx, difficulty, rng).catch(() => null);
    if (!made) {
      misses++;
      continue;
    }
    // The same prompt twice in a row is dull; skip repeats.
    if (out.some((q) => q.prompt[0] === made.prompt[0] && JSON.stringify(q.prompt[1]) === JSON.stringify(made.prompt[1]))) {
      misses++;
      continue;
    }
    out.push({ id: `${kind}-${out.length}`, category: kind, difficulty, ...made });
  }
  return out;
}

export type ExamResult = { question: Question; picked: number | null };

export function summarize(results: ExamResult[]) {
  const correct = results.filter((r) => r.picked === r.question.answer).length;
  return { total: results.length, correct, missed: results.filter((r) => r.picked !== r.question.answer) };
}
