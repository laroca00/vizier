import { useSyncExternalStore } from "react";
import { DEFAULT_HOME, type HomeLayout } from "./home/layout";
import { withAutoImportOn } from "./autoImportDefault";
import type { AutopilotMode } from "./autopilot";
import type { LanguageSetting } from "./i18n";
import { DEFAULT_REF, type RefSection } from "./overlay/reference";
import type { OverlayTheme, WidgetStyles } from "./overlay/appearance";

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
  /** Colour of the overlay cards. */
  overlayTheme: OverlayTheme;
  /** Size and opacity the player set for single widgets. */
  overlayWidgetStyles: WidgetStyles;
  /** On the loading screen, rank and champion mastery of all ten players. */
  overlayScouting: boolean;
  /** Your CS and level against the ranked average at this minute. */
  overlayBench: boolean;
  /** Dead players' respawn countdowns and the window they open. */
  overlayWindow: boolean;
  /** Notices when an enemy gets an ultimate rank or finishes an item. */
  overlaySpikes: boolean;
  /** Dragons per team and the soul. */
  overlayDragons: boolean;
  /** The player's own overlay hotkeys, by action id; anything missing keeps its default. */
  hotkeys: Record<string, string>;
  overlaySkills: boolean;
  overlayObjectives: boolean;
  overlayItems: boolean;
  overlayNextItem: boolean;
  overlayScoreboard: boolean;
  overlayTimers: boolean;
  /** In Arena and ARAM Mayhem, the champion's best augments of each rarity. */
  overlayAugments: boolean;
  /** The quick reference panel and the blocks it holds, in order. */
  overlayReference: boolean;
  overlayRefSections: RefSection[];
  /** The build panel that opens on its hotkey. */
  overlayBuild: boolean;
  /** Objective and camp timers drawn on the minimap. */
  overlayMinimap: boolean;
  /** The corner the game's minimap sits in. */
  overlayMinimapSide: "left" | "right";
  /** 0 to 1; matches the game's minimap scale, 0.5 is its default. */
  overlayMinimapSize: number;
  /** Whose jungle the manual camp timers are drawn in. */
  overlayCampSide: "enemy" | "own";
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
  /** Menu groups the player folded, by heading. */
  navFolded: string[];
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
  overlayTheme: "navy",
  overlayWidgetStyles: {},
  overlayScouting: true,
  overlayBench: true,
  overlayWindow: true,
  overlaySpikes: true,
  overlayDragons: true,
  hotkeys: {},
  overlaySkills: true,
  overlayObjectives: true,
  overlayItems: true,
  overlayNextItem: true,
  overlayScoreboard: true,
  overlayTimers: true,
  overlayAugments: true,
  overlayBuild: true,
  overlayReference: true,
  overlayRefSections: DEFAULT_REF,
  overlayMinimap: true,
  overlayMinimapSide: "right",
  overlayMinimapSize: 0.5,
  overlayCampSide: "enemy",
  timerSound: true,
  customTimerSeconds: 90,
  sidebarCollapsed: false,
  language: "auto",
  homeLayout: DEFAULT_HOME,
  navFolded: [],
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
