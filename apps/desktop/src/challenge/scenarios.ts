import { CHAMPION_FACTS } from "../quiz/championFacts";
import raw from "./scenarios.json";

// Draft Challenge scenarios, written by hand in Vizier's own words. They
// teach draft reasoning; none of it is measured from games, so the page that
// shows them labels them as editorial. Champion ids are Data Dragon ids.

export const SLOT_ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
export type SlotRole = (typeof SLOT_ROLES)[number];

export const CATEGORIES = ["frontline", "engage", "peel", "damage", "waveclear", "scaling", "early", "poke", "pick", "comp", "lane"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_TEXT: Record<Category, string> = {
  frontline: "Ön saf",
  engage: "Başlatma",
  peel: "Koruma",
  damage: "Hasar dengesi",
  waveclear: "Dalga temizleme",
  scaling: "Geç oyun",
  early: "Erken oyun",
  poke: "Uzaktan baskı",
  pick: "Yakalama",
  comp: "Takım dengesi",
  lane: "Koridor",
};

export type Text = { tr: string; en: string };
export type Answer = { champion: string; why: Text };

export type Scenario = {
  id: string;
  category: Category;
  /** 1 easy, 3 hard. */
  difficulty: 1 | 2 | 3;
  /** The role the player picks for; that slot of `blue` is null. */
  role: SlotRole;
  /** Five slots in TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY order; null is an empty slot. */
  blue: (string | null)[];
  red: (string | null)[];
  bans: string[];
  question: Text;
  /** What the scenario teaches, shown with the answer. */
  lesson: Text;
  /** Picks that fit the question, each with the reason. Any of them counts as right. */
  accepted: Answer[];
  /** Tempting picks that miss the point, with the reason. */
  rejected: Answer[];
};

export const SCENARIOS = raw as Scenario[];

const known = (id: string) => id in CHAMPION_FACTS;
const hasText = (t: Text) => !!t?.tr?.trim() && !!t?.en?.trim();

/** Problems found in a scenario; empty when it is well formed. */
export function validateScenario(s: Scenario): string[] {
  const problems: string[] = [];
  if (!s.id) problems.push("id missing");
  if (!(CATEGORIES as readonly string[]).includes(s.category)) problems.push(`category ${s.category}`);
  if (![1, 2, 3].includes(s.difficulty)) problems.push("difficulty");
  const slot = SLOT_ROLES.indexOf(s.role);
  if (slot < 0) problems.push(`role ${s.role}`);
  for (const [name, team] of [["blue", s.blue], ["red", s.red]] as const) {
    if (team.length !== 5) problems.push(`${name} needs five slots`);
    for (const id of team) if (id !== null && !known(id)) problems.push(`unknown champion ${id}`);
  }
  if (slot >= 0 && s.blue[slot] !== null) problems.push("the player's slot must be empty");
  if (s.blue.filter((id) => id === null).length !== 1) problems.push("blue has exactly one empty slot");
  for (const id of s.bans) if (!known(id)) problems.push(`unknown ban ${id}`);
  const used = [...s.blue, ...s.red, ...s.bans].filter((id): id is string => id !== null);
  if (new Set(used).size !== used.length) problems.push("a champion appears twice in the draft");
  if (!hasText(s.question)) problems.push("question text");
  if (!hasText(s.lesson)) problems.push("lesson text");
  if (s.accepted.length < 2) problems.push("needs at least two accepted answers");
  if (s.rejected.length < 1) problems.push("needs at least one rejected answer");
  const answers = [...s.accepted, ...s.rejected];
  for (const a of answers) {
    if (!known(a.champion)) problems.push(`unknown answer ${a.champion}`);
    if (used.includes(a.champion)) problems.push(`answer ${a.champion} is already in the draft`);
    if (!hasText(a.why)) problems.push(`reason for ${a.champion}`);
  }
  if (new Set(answers.map((a) => a.champion)).size !== answers.length) problems.push("an answer is listed twice");
  return problems;
}
