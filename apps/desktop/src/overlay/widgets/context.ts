import type { Params } from "../../i18n";
import type { Item } from "../../data/ddragon";
import type { Picks } from "../../api";
import type { BenchRead } from "../bench";
import type { PanelItem, PanelRunes } from "../buildPanel";
import type { MinimapBox, CampSide } from "../minimap";
import type { ManualTimers } from "../Timers";
import type { LiveGame, LivePlayer, SkillKey, Timer } from "../live";

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
  rowGap: number;
  /** Your CS and level against the average, with the CS gap over time; null without data or after minute 15. */
  bench: { read: BenchRead; history: number[] } | null;
  augments: AugmentGroup[];
  /** Patches the augment numbers come from, for the confidence read. */
  augmentPatches: string[];
  /** The card shows unless the player hid it with its hotkey. */
  augmentsShown: boolean;
  augmentNames: Map<number, { name: string }> | null;
};
