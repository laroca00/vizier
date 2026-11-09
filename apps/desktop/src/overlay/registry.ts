import type { Settings } from "../settings";

// What the overlay can show. This file holds only data; each widget's
// drawing lives in widgets/ and is looked up by id.

export type WidgetId = "skill" | "next" | "timers" | "items" | "augments" | "scoreboard" | "bench";
export type OverlayMode = "rift" | "aram" | "arena" | "mayhem";
export type Spot = { x: number; y: number };

export const MODES: OverlayMode[] = ["rift", "aram", "arena", "mayhem"];

export type WidgetDef = {
  id: WidgetId;
  /** Turkish name; run through `t()` where shown. */
  name: string;
  hint: string;
  modes: readonly OverlayMode[];
  /** The widget shows while any of these switches is on. */
  settings: readonly (keyof Settings)[];
  /** Where the widget sits until the player drags it; unset widgets stack in the left column. */
  defaultSpot?: Spot;
};

// A guess for a 16:9 screen at the default HUD scale; the player lines it up in edit mode.
export const SCOREBOARD_SPOT: Spot = { x: 0.482, y: 0.318 };

export const WIDGETS: readonly WidgetDef[] = [
  { id: "skill", name: "Yetenek önerisi", hint: "Yetenek puanın olduğunda hangisini yükselteceğini gösterir.", modes: MODES, settings: ["overlaySkills"] },
  { id: "next", name: "Sıradaki eşya", hint: "Seçtiğin build türünde henüz almadığın ilk eşya ve ona kalan altın.", modes: MODES, settings: ["overlayNextItem"] },
  { id: "timers", name: "Süreler", hint: "Ejder, Baron ve inhibitör süreleri ile elle başlatılan zamanlayıcılar.", modes: MODES, settings: ["overlayObjectives", "overlayTimers"] },
  { id: "items", name: "Eşya altını farkı", hint: "Koridor rakibine ve rakip takıma göre eşyalarına harcanan altın.", modes: MODES, settings: ["overlayItems"] },
  { id: "bench", name: "Karşılaştırma", hint: "İlk 15 dakikada minyon sayın ve seviyen, aynı şampiyon ve rolün Emerald+ ortalamasıyla.", modes: ["rift"], settings: ["overlayBench"] },
  { id: "augments", name: "Augment önerisi", hint: "Arena ve Şamata'da şampiyonunun her nadirlikteki en iyi augment'leri.", modes: ["arena", "mayhem"], settings: ["overlayAugments"] },
  {
    id: "scoreboard",
    name: "Skor tablosu farkı",
    hint: "Tab'a basılıyken her oyuncunun karşısındakine göre eşya altını farkı.",
    modes: MODES,
    settings: ["overlayScoreboard"],
    defaultSpot: SCOREBOARD_SPOT,
  },
];

export const widgetById = (id: WidgetId) => WIDGETS.find((w) => w.id === id);

/** The overlay mode a Live Client game mode belongs to. */
export function modeOf(gameMode: string): OverlayMode {
  if (gameMode === "CHERRY") return "arena";
  if (gameMode === "KIWI") return "mayhem";
  if (gameMode === "ARAM") return "aram";
  return "rift";
}

export const widgetsFor = (mode: OverlayMode) => WIDGETS.filter((w) => w.modes.includes(mode));
