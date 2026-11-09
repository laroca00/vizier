import type { Params } from "../../i18n";
import type { Item } from "../../data/ddragon";
import type { Picks } from "../../api";
import type { LiveGame, LivePlayer, SkillKey, Timer } from "../live";

export type AugmentGroup = { rarity: number; augments: { augmentId: number; tier: string }[] };

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
  objectives: Timer[];
  itemGold: { lane: number | null; team: number } | null;
  nextItem: number | null;
  rows: { ally: LivePlayer; diff: number | null }[];
  rowGap: number;
  augments: AugmentGroup[];
  augmentNames: Map<number, { name: string }> | null;
};
