import type { ChampionOverview } from "../api";

export type RoleCheck = { kind: "ok" } | { kind: "off"; usual: string | null; share: number };

/** Below this share of the champion's games the role counts as unusual. */
export const OFF_ROLE_SHARE = 0.1;
/** A share from fewer games than this says nothing. */
export const MIN_ROLE_GAMES = 200;

/**
 * Whether the champion is normally played in the role the ally was given.
 * Roles come from the overview's position shares; thin data never warns.
 */
export function checkRole(overview: Pick<ChampionOverview, "positions">, role: string): RoleCheck {
  const total = overview.positions.reduce((sum, p) => sum + p.games, 0);
  if (total < MIN_ROLE_GAMES) return { kind: "ok" };
  const here = overview.positions.find((p) => p.position === role);
  const share = here ? here.games / total : 0;
  if (share >= OFF_ROLE_SHARE) return { kind: "ok" };
  const usual = [...overview.positions].sort((a, b) => b.games - a.games)[0]?.position ?? null;
  return { kind: "off", usual, share };
}
