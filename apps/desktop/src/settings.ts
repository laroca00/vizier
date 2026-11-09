import { useSyncExternalStore } from "react";
import { DEFAULT_HOME, type HomeLayout } from "./home/layout";
import { withAutoImportOn } from "./autoImportDefault";
import type { AutopilotMode } from "./autopilot";
import type { LanguageSetting } from "./i18n";

export type Settings = {
  autoImportRunes: boolean;
  autoImportSpells: boolean;
  autoImportItems: boolean;
  showOnChampSelect: boolean;
  /** The main window goes to the tray when a game starts and comes back when it ends. */
  hideOnGame: boolean;
  /** A Vizier that started hidden in the tray shows itself when the League client opens. */
  showOnClientOpen: boolean;
  /** A tone and a taskbar flash when a match is found; off unless the player asks. */
  readyCheckAlert: boolean;
  /** Hover (and lock) the first available champion of the pick plan on the player's turn. */
  autopilot: AutopilotMode;
  /** Lock this many seconds before the timer ends; 0 locks right away. */
  autopilotLockSeconds: number;
  /** Accept the ready check as soon as a match is found. */
  autoAcceptReady: boolean;
  overlay: boolean;
  /** Size of every overlay box, 0.8 to 1.4. */
  overlayScale: number;
  overlaySkills: boolean;
  overlayObjectives: boolean;
  overlayItems: boolean;
  overlayNextItem: boolean;
  overlayScoreboard: boolean;
  overlayTimers: boolean;
  /** In Arena and ARAM Mayhem, the champion's best augments of each rarity. */
  overlayAugments: boolean;
  /** A short tone when a manual timer or an objective is about to come up. */
  timerSound: boolean;
  /** Length of the Ctrl+Shift+T timer. */
  customTimerSeconds: number;
  /** The side menu shrinks to an icon rail. */
  sidebarCollapsed: boolean;
  /** "auto" follows the League client's language. */
  language: LanguageSetting;
  /** Which Home cards show, in order. */
  homeLayout: HomeLayout;
};

const DEFAULTS: Settings = {
  autoImportRunes: true,
  autoImportSpells: true,
  autoImportItems: true,
  showOnChampSelect: true,
  hideOnGame: true,
  showOnClientOpen: true,
  readyCheckAlert: false,
  autopilot: "off",
  autopilotLockSeconds: 0,
  autoAcceptReady: false,
  overlay: true,
  overlayScale: 1,
  overlaySkills: true,
  overlayObjectives: true,
  overlayItems: true,
  overlayNextItem: true,
  overlayScoreboard: true,
  overlayTimers: true,
  overlayAugments: true,
  timerSound: true,
  customTimerSeconds: 90,
  sidebarCollapsed: false,
  language: "auto",
  homeLayout: DEFAULT_HOME,
};

const KEY = "vizier.settings";
const listeners = new Set<() => void>();

const AUTO_IMPORT_KEY = "vizier.settings.autoImportOn";

function read(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    let stored: Partial<Settings> = JSON.parse(raw ?? "{}");
    if (localStorage.getItem(AUTO_IMPORT_KEY) !== "1") {
      if (raw !== null) {
        stored = withAutoImportOn(stored);
        localStorage.setItem(KEY, JSON.stringify({ ...DEFAULTS, ...stored }));
      }
      localStorage.setItem(AUTO_IMPORT_KEY, "1");
    }
    return { ...DEFAULTS, ...stored };
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
