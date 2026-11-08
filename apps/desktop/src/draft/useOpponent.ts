import { useRef } from "react";
import { getChampion } from "../api";
import { useAsync } from "../useAsync";
import { guessOpponent, type RoleShares } from "./logic";

/** Where each enemy champion is usually played, from Vizier's own games. */
function useRoleShares(enemies: number[]): RoleShares | null {
  const ids = [...new Set(enemies.filter((id) => id > 0))].sort((a, b) => a - b);
  const [state] = useAsync(ids.length ? `roles:${ids.join(",")}` : null, async () => {
    const overviews = await Promise.all(ids.map((id) => getChampion(id, null).catch(() => null)));
    return new Map(ids.map((id, i) => [id, new Map((overviews[i]?.positions ?? []).map((p) => [p.position, p.share]))]));
  });
  // Keep the last answer while the next enemy pick loads, so the guess doesn't blink.
  const last = useRef<RoleShares | null>(null);
  if (state.status === "done") last.current = state.value;
  return last.current;
}

export type Opponent = { championId: number; guessed: boolean } | null;

/** The player's choice wins; otherwise Vizier's guess from the champions' usual roles. */
export function useOpponent(enemies: number[], role: string | null, chosen: number | null): Opponent {
  const shares = useRoleShares(enemies);
  if (chosen !== null && enemies.includes(chosen)) return { championId: chosen, guessed: false };
  if (!role || !shares) return null;
  const guess = guessOpponent(enemies, role, shares);
  return guess === null ? null : { championId: guess, guessed: true };
}
