import { useSyncExternalStore } from "react";
import { BRACKET_LABELS, type Bracket } from "@vizier/shared/brackets";
import { myBracket, resolveRank, subscribeRank } from "./rankChoice";
import { useSettings } from "./settings";

export function useRank() {
  const { rank } = useSettings();
  const own = useSyncExternalStore(subscribeRank, myBracket);
  return { choice: rank, ...resolveRank(rank, own) };
}

/** The bracket requests use, as a hook, for keys that must change with it. */
export const useBracket = (): Bracket => useRank().bracket;

export const rankLabel = (bracket: Bracket, lang: "tr" | "en") => BRACKET_LABELS[bracket][lang];
