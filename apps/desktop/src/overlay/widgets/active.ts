import type { Settings } from "../../settings";
import type { WidgetId } from "../registry";
import type { WidgetContext } from "./context";

/** Whether a widget has anything to draw right now; boxes without content are left out. */
export const hasContent: Record<WidgetId, (ctx: WidgetContext, settings: Settings) => boolean> = {
  skill: (ctx) => ctx.skill !== null,
  next: (ctx) => ctx.nextItem !== null && ctx.version !== null,
  timers: (ctx, settings) => ctx.objectives.length > 0 || settings.overlayTimers,
  skillOrder: (ctx) => ctx.skillOrder.shown && ctx.skillOrder.keys.length > 0,
  bench: (ctx) => ctx.bench !== null,
  items: (ctx) => ctx.itemGold !== null,
  augments: (ctx) => ctx.augments.length > 0 && ctx.augmentNames !== null,
  scoreboard: (ctx) => ctx.rows.length > 0,
};
