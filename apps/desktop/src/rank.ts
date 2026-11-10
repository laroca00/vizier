import { useEffect, useSyncExternalStore } from "react";
import { BRACKET_LABELS, type Bracket } from "@vizier/shared/brackets";
import { inDraftScope, myBracket, resolveRank, setDraftScope, subscribeRank } from "./rankChoice";
import { useSettings } from "./settings";

export function useRank() {
  const { rank } = useSettings();
  const own = useSyncExternalStore(subscribeRank, myBracket);
  const inDraft = useSyncExternalStore(subscribeRank, inDraftScope);
  const choice = inDraft ? "mine" : rank;
  return { choice, inDraft, ...resolveRank(choice, own) };
}

/** The bracket requests use, as a hook, for keys that must change with it. */
export const useBracket = (): Bracket => useRank().bracket;

export const rankLabel = (bracket: Bracket, lang: "tr" | "en") => BRACKET_LABELS[bracket][lang];

/** Marks champ select as open for as long as the calling page is mounted, so its requests can follow the player's own rank. */
export function useDraftRankScope() {
  useEffect(() => {
    setDraftScope(true);
    return () => setDraftScope(false);
  }, []);
}
