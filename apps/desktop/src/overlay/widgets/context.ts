import type { Params } from "../../i18n";
import type { Item } from "../../data/ddragon";
import type { Picks } from "../../api";
import type { BenchRead } from "../bench";
import type { PanelItem, PanelRunes } from "../buildPanel";
import type { MinimapBox, CampSide } from "../minimap";
import type { ManualTimers } from "../Timers";
import type { Combo } from "../../data/combos";
import type { RefSection } from "../reference";
import type { LiveGame, LivePlayer, SkillKey, Timer } from "../live";
import type { Fallen, Window } from "../opportunity";
import type { Spike } from "../spikes";

export type AugmentGroup = { rarity: number; augments: { augmentId: number; tier: string; winRate: number; games: number }[] };

/** Everything a widget may draw from, worked out once per frame by the overlay. */
export type WidgetContext = {
  t: (text: string, params?: Params) => string;
  game: LiveGame;
  me: LivePlayer;
  /** Game clock in seconds, smoothed between the Live Client's updates. */
  time: number;
  version: string | null;
  items: Map<number, Item> | null;
  gold: (itemId: number) => number;
  picks: Picks | null;
  skill: SkillKey | null;
  /** The full 18-level order of the build, empty without a build; `ranked` levels are already spent. */
  skillOrder: { keys: SkillKey[]; ranked: number; shown: boolean };
  objectives: Timer[];
  /** Timers the player started with shortcuts, kept here so the minimap can draw them too. */
  manualTimers: ManualTimers;
  minimap: { box: MinimapBox; campSide: CampSide };
  itemGold: { lane: number | null; team: number } | null;
  nextItem: number | null;
  rows: { ally: LivePlayer; diff: number | null }[];
  /** Item gold of the whole team against the enemy team, shown under the scoreboard rows. */
  /** The build panel: shown only while its hotkey has it open. */
  buildPanel: { shown: boolean; items: PanelItem[]; runes: PanelRunes | null };
  rowsTotal: number | null;
  /** The quick reference panel: open only while its hotkey has it so. */
  reference: { shown: boolean; sections: RefSection[]; combos: Combo[]; note: { text: string; matchup: boolean } | null; opponent: string | null; lang: "tr" | "en" };
  rowGap: number;
  /** Your CS and level against the average, with the CS gap over time; null without data or after minute 15. */
  bench: { read: BenchRead; history: number[] } | null;
  augments: AugmentGroup[];
  /** Patches the augment numbers come from, for the confidence read. */
  augmentPatches: string[];
  /** The card shows unless the player hid it with its hotkey. */
  augmentsShown: boolean;
  augmentNames: Map<number, { name: string }> | null;
  /** Data Dragon id to the champion's name. */
  championName: (key: string) => string;
  /** Dead players and the window their deaths open. */
  opportunity: { fallen: Fallen[]; window: Window | null };
  /** Fresh notices of enemy ultimate ranks and finished items. */
  spikes: Spike[];
};
