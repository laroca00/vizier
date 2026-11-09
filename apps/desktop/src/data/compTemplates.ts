import raw from "./compTemplates.json";
import { archetypesOf } from "./archetypes";
import type { Champion } from "./ddragon";
import { traitsOf, type Phase, type Traits } from "./traits";

// Team plans in Vizier's own words. A template says what a team needs to play
// a plan, as rules over the hand-kept traits and archetypes. It is a reading
// of how League is played, not something measured from games, so pages that
// show it mark it as editorial.

export type Localized = { tr: string; en: string };
export type BoolTrait = {
  [K in keyof Traits]: Traits[K] extends boolean ? K : never;
}[keyof Traits];

/** One thing the plan needs: at least `min` champions that satisfy any of the conditions. */
export type Need = {
  trait?: BoolTrait;
  archetypes?: string[];
  phase?: Phase;
  min: number;
  /** What is missing when the team has fewer, as a short phrase. */
  lacking: Localized;
};

export type CompTemplate = {
  id: string;
  name: Localized;
  objective: Localized;
  phase: Phase;
  /** Roles that carry the plan, in League's position names. */
  roles: string[];
  needs: Need[];
  strengths: Localized;
  weaknesses: Localized;
  /** Template ids that tend to beat this plan. */
  counteredBy: string[];
};

export const COMP_TEMPLATES = raw as CompTemplate[];

export const TEMPLATE_BY_ID = new Map(COMP_TEMPLATES.map((t) => [t.id, t]));

/** Whether a champion counts toward a need. */
export function satisfies(need: Need, champion: Champion): boolean {
  const traits = traitsOf(champion);
  if (need.trait && traits[need.trait]) return true;
  if (need.phase && traits.phase === need.phase) return true;
  return !!need.archetypes && archetypesOf(champion.id).some((a) => need.archetypes!.includes(a.id));
}

/** Champions that would bring at least one thing the template needs, with the needs each fills. */
export function fittingChampions(template: CompTemplate, champions: Iterable<Champion>): { champion: Champion; fills: number[] }[] {
  const out: { champion: Champion; fills: number[] }[] = [];
  for (const champion of champions) {
    const fills = template.needs.flatMap((need, i) => (satisfies(need, champion) ? [i] : []));
    if (fills.length > 0) out.push({ champion, fills });
  }
  // Those who fill more of the plan first.
  return out.sort((a, b) => b.fills.length - a.fills.length || a.champion.name.localeCompare(b.champion.name));
}
