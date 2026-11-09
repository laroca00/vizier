import { useEffect } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Bracket } from "@vizier/shared/brackets";
import { updateSettings } from "../settings";

/**
 * The published bracket closest to a solo queue tier. Brackets overlap, so this
 * picks the one whose games are mostly played at that rank: Iron to Gold read
 * "gold and below", Master and up read "master+".
 */
export function bracketForTier(tier: string | null | undefined): Bracket | null {
  switch (tier?.toUpperCase()) {
    case "IRON":
    case "BRONZE":
    case "SILVER":
    case "GOLD":
      return "gold_minus";
    case "PLATINUM":
      return "platinum_plus";
    case "EMERALD":
      return "emerald_plus";
    case "DIAMOND":
      return "diamond_plus";
    case "MASTER":
    case "GRANDMASTER":
    case "CHALLENGER":
      return "master_plus";
    default:
      return null;
  }
}

/** Reads the player's tier from the client and saves its bracket; unranked clears it. */
export async function refreshMyRank(read: () => Promise<string | null> = () => invoke<string | null>("my_ranked_tier")) {
  try {
    updateSettings({ myRank: bracketForTier(await read()) });
  } catch {
    // The client may be busy; the last known bracket stays.
  }
}

/** Looks the rank up each time the client connects. */
export function useMyRank(connected: boolean) {
  useEffect(() => {
    if (connected && isTauri()) void refreshMyRank();
  }, [connected]);
}
