import { useSyncExternalStore } from "react";
import type { LanguageSetting } from "./i18n";

export type Settings = {
  autoImportRunes: boolean;
  autoImportSpells: boolean;
  autoImportItems: boolean;
  showOnChampSelect: boolean;
  openAnalysisAfterGame: boolean;
  overlay: boolean;
  overlaySkills: boolean;
  overlayObjectives: boolean;
  overlayBenchmarks: boolean;
  overlayItems: boolean;
  overlayPace: boolean;
  overlayScouting: boolean;
  overlayNextItem: boolean;
  overlayGoal: boolean;
  overlayScoreboard: boolean;
  overlayTimers: boolean;
  /** A short tone when a manual timer or an objective is about to come up. */
  timerSound: boolean;
  /** Length of the Ctrl+Shift+T timer. */
  customTimerSeconds: number;
  tiltWarnings: boolean;
  /** Switch to the queue screen when matchmaking starts. */
  queueCompanion: boolean;
  /** The side menu shrinks to an icon rail. */
  sidebarCollapsed: boolean;
  /** "auto" follows the League client's language. */
  language: LanguageSetting;
};

const DEFAULTS: Settings = {
  autoImportRunes: false,
  autoImportSpells: false,
  autoImportItems: true,
  showOnChampSelect: true,
  openAnalysisAfterGame: true,
  overlay: true,
  overlaySkills: true,
  overlayObjectives: true,
  overlayBenchmarks: true,
  overlayItems: true,
  overlayPace: true,
  overlayScouting: true,
  overlayNextItem: true,
  overlayGoal: true,
  overlayScoreboard: true,
  overlayTimers: true,
  timerSound: true,
  customTimerSeconds: 90,
  tiltWarnings: true,
  queueCompanion: true,
  sidebarCollapsed: false,
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
