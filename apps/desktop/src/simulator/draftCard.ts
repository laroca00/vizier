import { championIconUrl, type Champion } from "../data/ddragon";
import { ARCHETYPE_NAMES, winConditions } from "../draft/winConditions";
import type { Draft } from "./store";

export type DraftCardTeam = { picks: { name: string; icon: string | null }[]; plan: string | null };

export type DraftCardContent = { title: string; blue: DraftCardTeam; red: DraftCardTeam; bans: { name: string; icon: string }[] };

type T = (text: string) => string;

/**
 * What a draft picture shows: both teams in slot order (empty slots kept, so
 * roles stay in their rows), each team's main plan from the composition
 * rules, and the bans.
 */
export function draftCardContent(draft: Draft, champions: Map<number, Champion>, version: string, title: string, t: T): DraftCardContent {
  const team = (ids: number[]): DraftCardTeam => {
    const known = ids.map((id) => (id > 0 ? (champions.get(id) ?? null) : null));
    const picks = known.map((c) => ({ name: c?.name ?? "", icon: c ? championIconUrl(version, c.id) : null }));
    const present = known.filter((c): c is Champion => c !== null);
    // A plan from two or three champions says little; wait for most of the team.
    const plan = present.length >= 4 ? (winConditions(present)[0] ?? null) : null;
    return { picks, plan: plan ? t(ARCHETYPE_NAMES[plan.archetype]) : null };
  };
  const bans = draft.bans.flatMap((id) => {
    const c = champions.get(id);
    return c ? [{ name: c.name, icon: championIconUrl(version, c.id) }] : [];
  });
  return { title, blue: team(draft.blue), red: team(draft.red), bans };
}
