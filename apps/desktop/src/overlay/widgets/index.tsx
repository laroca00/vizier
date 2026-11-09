import type { ComponentType } from "react";
import type { WidgetId } from "../registry";
import { AugmentsWidget } from "./AugmentsWidget";
import type { WidgetContext } from "./context";
import { BenchWidget } from "./BenchWidget";
import { ItemGoldWidget } from "./ItemGoldWidget";
import { NextItemWidget } from "./NextItemWidget";
import { ScoreboardWidget } from "./ScoreboardWidget";
import { SkillOrderWidget } from "./SkillOrderWidget";
import { SkillWidget } from "./SkillWidget";
import { TimersWidget } from "./TimersWidget";

export const WIDGET_VIEWS: Record<WidgetId, ComponentType<WidgetContext>> = {
  skill: SkillWidget,
  skillOrder: SkillOrderWidget,
  next: NextItemWidget,
  timers: TimersWidget,
  items: ItemGoldWidget,
  bench: BenchWidget,
  augments: AugmentsWidget,
  scoreboard: ScoreboardWidget,
};
