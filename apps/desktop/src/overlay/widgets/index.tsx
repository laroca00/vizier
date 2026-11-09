import type { ComponentType } from "react";
import type { WidgetId } from "../registry";
import { AugmentsWidget } from "./AugmentsWidget";
import type { WidgetContext } from "./context";
import { ItemGoldWidget } from "./ItemGoldWidget";
import { NextItemWidget } from "./NextItemWidget";
import { ScoreboardWidget } from "./ScoreboardWidget";
import { SkillWidget } from "./SkillWidget";
import { TimersWidget } from "./TimersWidget";

export const WIDGET_VIEWS: Record<WidgetId, ComponentType<WidgetContext>> = {
  skill: SkillWidget,
  next: NextItemWidget,
  timers: TimersWidget,
  items: ItemGoldWidget,
  augments: AugmentsWidget,
  scoreboard: ScoreboardWidget,
};
