import { useSyncExternalStore } from "react";
import type { LanguageSetting } from "./i18n";

export type Settings = {
  autoImportRunes: boolean;
  autoImportSpells: boolean;
  autoImportItems: boolean;
  showOnChampSelect: boolean;
  openAnalysisAfterGame: boolean;
  pauseBackgroundInGame: boolean;
  overlay: boolean;
  overlaySkills: boolean;
  overlayObjectives: boolean;
  overlayBenchmarks: boolean;
  overlayItems: boolean;
  overlayPace: boolean;
  overlayScouting: boolean;
  /** "auto" follows the League client's language. */
  language: LanguageSetting;
};

const DEFAULTS: Settings = {
  autoImportRunes: false,
  autoImportSpells: false,
  autoImportItems: true,
  showOnChampSelect: true,
  openAnalysisAfterGame: true,
  pauseBackgroundInGame: true,
  overlay: true,
  overlaySkills: true,
  overlayObjectives: true,
  overlayBenchmarks: true,
  overlayItems: true,
  overlayPace: true,
  overlayScouting: true,
  language: "auto",
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

// The overlay is a second window on the same origin; this keeps it in step
// with changes made on the settings page.
window.addEventListener("storage", (event) => {
  if (event.key !== KEY) return;
  current = read();
  for (const listener of listeners) listener();
});

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
