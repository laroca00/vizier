import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { lcuFixture } from "./dev/fixtures";
import { translate, type Lang } from "./i18n";

export type Summoner = { gameName: string; tagLine: string; puuid: string };

/** The servers Vizier serves players on. */
export type Platform = "tr1" | "euw1";

/** The client's server ("TR", "EUW") and language ("tr_TR", "en_GB"). */
export type RegionLocale = { region: string; locale: string };

export type LcuStatus =
  | { state: "disconnected" }
  | { state: "connecting" }
  | { state: "connected"; summoner: Summoner | null; phase: string | null; lastGameId: number | null; region: RegionLocale | null };

/** TR when the client is on another server or unknown. */
export function platformOf(region: RegionLocale | null | undefined): Platform {
  return region?.region.toUpperCase() === "EUW" ? "euw1" : "tr1";
}

/** match-v5 ids start with the platform: "EUW1_123". */
export function matchIdFor(platform: Platform, gameId: number) {
  return `${platform.toUpperCase()}_${gameId}`;
}

const PHASE_LABELS: Record<string, string> = {
  Lobby: "Lobide",
  Matchmaking: "Maç aranıyor",
  ReadyCheck: "Maç bulundu",
  ChampSelect: "Şampiyon seçiminde",
  GameStart: "Oyun başlıyor",
  InProgress: "Oyunda",
  Reconnect: "Oyuna yeniden bağlanıyor",
  WaitingForStats: "Maç bitti",
  PreEndOfGame: "Maç bitti",
  EndOfGame: "Maç bitti",
};

export function phaseLabel(phase: string | null, lang: Lang = "tr"): string | null {
  const label = phase ? PHASE_LABELS[phase] : undefined;
  return label ? translate(lang, label) : null;
}

export type DraftMember = {
  cellId: number;
  championId: number;
  pickIntent: number;
  /** Lowercase LCU position (`middle`, `utility`, ...), empty outside role queues. */
  position: string;
  spells: [number, number];
  isLocal: boolean;
};

export type ChampSelect = {
  myTeam: DraftMember[];
  theirTeam: DraftMember[];
  bans: number[];
  phase: string;
  phaseEndsAt: number;
};

/** Subscribes to a backend event and seeds it from a command on mount. */
function useBackendState<T>(event: string, command: string, initial: T): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let heardEvent = false;
    const unlisten = listen<T>(event, (e) => {
      heardEvent = true;
      setValue(e.payload);
    });
    // An event can land before this resolves; it is newer, so keep it.
    invoke<T>(command).then((current) => {
      if (active && !heardEvent) setValue(current);
    });
    return () => {
      active = false;
      unlisten.then((stop) => stop());
    };
  }, [event, command]);

  return value;
}

export function useLcuStatus(): LcuStatus {
  return useBackendState<LcuStatus>("lcu-status", "lcu_status", lcuFixture() ?? { state: "disconnected" });
}

export function useChampSelect(): ChampSelect | null {
  return useBackendState<ChampSelect | null>("lcu-champ-select", "champ_select", null);
}
