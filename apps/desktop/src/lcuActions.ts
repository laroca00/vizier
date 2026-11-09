import { invoke } from "@tauri-apps/api/core";

export type ActionKind = "pick" | "ban";

/** Puts the champion on the player's open pick or ban without confirming it. */
export const hoverChampion = (kind: ActionKind, championId: number) => invoke<void>("champ_select_act", { kind, championId, lock: false });

/** Confirms the champion; the client rejects it outside the player's turn. */
export const lockChampion = (kind: ActionKind, championId: number) => invoke<void>("champ_select_act", { kind, championId, lock: true });

export const acceptReadyCheck = () => invoke<void>("accept_ready_check");

export const swapFromBench = (championId: number) => invoke<void>("bench_swap", { championId });

export const availableChampions = (kind: ActionKind) => invoke<number[]>("available_champions", { kind });
