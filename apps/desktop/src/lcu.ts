import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Summoner = { gameName: string; tagLine: string };

export type LcuStatus =
  | { state: "disconnected" }
  | { state: "connecting" }
  | { state: "connected"; summoner: Summoner | null; phase: string | null };

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

export function phaseLabel(phase: string | null): string | null {
  return phase ? (PHASE_LABELS[phase] ?? null) : null;
}

export function useLcuStatus(): LcuStatus {
  const [status, setStatus] = useState<LcuStatus>({ state: "disconnected" });

  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let heardEvent = false;
    const unlisten = listen<LcuStatus>("lcu-status", (event) => {
      heardEvent = true;
      setStatus(event.payload);
    });
    // An event can land before this resolves; it is newer, so keep it.
    invoke<LcuStatus>("lcu_status").then((initial) => {
      if (active && !heardEvent) setStatus(initial);
    });
    return () => {
      active = false;
      unlisten.then((stop) => stop());
    };
  }, []);

  return status;
}
