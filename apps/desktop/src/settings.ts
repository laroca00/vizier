import { useSyncExternalStore } from "react";

export type Settings = {
  autoImportRunes: boolean;
  autoImportSpells: boolean;
  autoImportItems: boolean;
  showOnChampSelect: boolean;
  openAnalysisAfterGame: boolean;
  pauseBackgroundInGame: boolean;
};

const DEFAULTS: Settings = {
  autoImportRunes: false,
  autoImportSpells: false,
  autoImportItems: true,
  showOnChampSelect: true,
  openAnalysisAfterGame: true,
  pauseBackgroundInGame: true,
};

const KEY = "vizier.settings";
const listeners = new Set<() => void>();

function read(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

let current = read();

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Settings still apply for this session.
  }
  for (const listener of listeners) listener();
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
