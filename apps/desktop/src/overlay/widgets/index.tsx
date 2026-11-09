import type { ComponentType } from "react";
import type { WidgetId } from "../registry";
import { BuildWidget } from "./BuildWidget";
import { AugmentsWidget } from "./AugmentsWidget";
import type { WidgetContext } from "./context";
import { BenchWidget } from "./BenchWidget";
import { ItemGoldWidget } from "./ItemGoldWidget";
import { MinimapWidget } from "./MinimapWidget";
import { NextItemWidget } from "./NextItemWidget";
import { ScoreboardWidget } from "./ScoreboardWidget";
import { SkillOrderWidget } from "./SkillOrderWidget";
import { ReferenceWidget } from "./ReferenceWidget";
import { SkillWidget } from "./SkillWidget";
import { TimersWidget } from "./TimersWidget";
import { WindowWidget } from "./WindowWidget";
import { SpikesWidget } from "./SpikesWidget";
import { DragonsWidget } from "./DragonsWidget";
import { PlanWidget } from "./PlanWidget";
import { FlashWidget } from "./FlashWidget";

export const WIDGET_VIEWS: Record<WidgetId, ComponentType<WidgetContext>> = {
  build: BuildWidget,
  reference: ReferenceWidget,
  skill: SkillWidget,
  skillOrder: SkillOrderWidget,
  next: NextItemWidget,
  timers: TimersWidget,
  items: ItemGoldWidget,
  minimap: MinimapWidget,
  bench: BenchWidget,
  augments: AugmentsWidget,
  scoreboard: ScoreboardWidget,
  window: WindowWidget,
  spikes: SpikesWidget,
  dragons: DragonsWidget,
  plan: PlanWidget,
  flash: FlashWidget,
};
