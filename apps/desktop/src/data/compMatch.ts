import { COMP_TEMPLATES, satisfies, type CompTemplate, type Need } from "./compTemplates";
import type { Champion } from "./ddragon";

export type NeedStatus = { need: Need; have: string[]; met: boolean };
export type TemplateMatch = { template: CompTemplate; needs: NeedStatus[]; metCount: number; progress: number };

/** A team smaller than this says too little to match against a plan. */
export const MATCH_MIN_TEAM = 3;

export function matchTemplate(template: CompTemplate, team: Champion[]): TemplateMatch {
  const needs = template.needs.map((need) => {
    const have = team.filter((c) => satisfies(need, c)).map((c) => c.name);
    return { need, have, met: have.length >= need.min };
  });
  // Partly met needs count in proportion, so one champion short ranks above none.
  const progress = needs.reduce((sum, n) => sum + Math.min(n.have.length / n.need.min, 1), 0) / needs.length;
  return { template, needs, metCount: needs.filter((n) => n.met).length, progress };
}

/** The plans the team is closest to, most complete first; ties keep the template order. */
export function closestTemplates(team: Champion[], limit = 3): TemplateMatch[] {
  if (team.length < MATCH_MIN_TEAM) return [];
  return COMP_TEMPLATES.map((t) => matchTemplate(t, team))
    .filter((m) => m.progress > 0)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, limit);
}

/**
 * Champions that would meet a need, the player's own pool first. Anyone
 * already in the draft, banned or taken is left out by the caller through `unavailable`.
 */
export function fillers(need: Need, candidates: Iterable<Champion>, pool: Set<number>, unavailable: Set<number>, limit = 5): Champion[] {
  const fits = [...candidates].filter((c) => !unavailable.has(c.key) && satisfies(need, c));
  fits.sort((a, b) => Number(pool.has(b.key)) - Number(pool.has(a.key)) || a.name.localeCompare(b.name));
  return fits.slice(0, limit);
}
