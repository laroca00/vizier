import { useEffect } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { bracketForTier } from "@vizier/shared/brackets";
import type { LcuStatus } from "./lcu";
import { setMyBracket } from "./rankChoice";

export type SoloRank = { tier: string; division: string };

/**
 * Reads the player's solo queue tier from the client and tells the rank
 * setting which bracket "Benim rankım" means. Unranked, a closed client or a
 * failed read leave it unknown, and the stats fall back to Emerald+ with a note.
 */
export function useMyRank(status: LcuStatus) {
  const connected = status.state === "connected";
  // A game ends or a lobby opens: the rank may have changed since the last look.
  const phase = status.state === "connected" ? status.phase : null;
  const recheck = phase === "EndOfGame" || phase === "Lobby";
  useEffect(() => {
    if (!connected || !isTauri()) {
      setMyBracket(null);
      return;
    }
    let current = true;
    invoke<SoloRank | null>("my_rank").then(
      (rank) => current && setMyBracket(bracketForTier(rank?.tier)),
      () => current && setMyBracket(null),
    );
    return () => {
      current = false;
    };
  }, [connected, recheck]);
}
