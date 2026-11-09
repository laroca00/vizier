import type { Settings } from "../../settings";
import type { WidgetId } from "../registry";
import type { WidgetContext } from "./context";

/** Whether a widget has anything to draw right now; boxes without content are left out. */
export const hasContent: Record<WidgetId, (ctx: WidgetContext, settings: Settings) => boolean> = {
  skill: (ctx) => ctx.skill !== null,
  build: (ctx) => ctx.buildPanel.shown && (ctx.buildPanel.items.length > 0 || ctx.skillOrder.keys.length > 0),
  reference: (ctx, settings) => ctx.reference.shown && settings.overlayRefSections.length > 0,
  next: (ctx) => ctx.nextItem !== null && ctx.version !== null,
  timers: (ctx, settings) => ctx.objectives.length > 0 || settings.overlayTimers,
  skillOrder: (ctx) => ctx.skillOrder.shown && ctx.skillOrder.keys.length > 0,
  bench: (ctx) => ctx.bench !== null,
  items: (ctx) => ctx.itemGold !== null,
  augments: (ctx) => ctx.augmentsShown && ctx.augments.length > 0 && ctx.augmentNames !== null,
  minimap: (ctx) => ctx.objectives.length > 0 || ctx.manualTimers.manual.length > 0,
  scoreboard: (ctx) => ctx.rows.length > 0,
};

/**
 * Panels the player opens with a hotkey say so quietly when they have nothing
 * to show, instead of staying blank. Null when there is nothing to say.
 */
export function emptyText(id: WidgetId, ctx: WidgetContext): string | null {
  if (id === "build" && ctx.buildPanel.shown && ctx.buildPanel.items.length === 0 && ctx.skillOrder.keys.length === 0) return "Bu rol için build verisi yok";
  if (id === "skillOrder" && ctx.skillOrder.shown && ctx.skillOrder.keys.length === 0) return "Yetenek sırası verisi yok";
  return null;
}
