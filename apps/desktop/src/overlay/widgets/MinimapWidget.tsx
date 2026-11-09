import { clock } from "../live";
import { campSpot, onScreen, timerSpot } from "../minimap";
import type { WidgetContext } from "./context";
import { timerLabel } from "./shared";

/** Timers next to the places they belong to on the minimap. */
export function MinimapWidget({ t, objectives, manualTimers, time, me, minimap }: WidgetContext) {
  const marks = [
    ...objectives.flatMap((timer) => {
      const spot = timerSpot(timer, me.team);
      return spot ? [{ id: timer.id, label: timerLabel(timer, t), at: timer.at, spot, ours: timer.ours }] : [];
    }),
    ...manualTimers.manual.flatMap((m) => {
      const spot = campSpot(m.id, me.team, minimap.campSide);
      return spot ? [{ id: m.id, label: t(m.label), at: m.at, spot, ours: null }] : [];
    }),
  ];
  if (marks.length === 0) return null;
  return (
    <>
      {marks.map((mark) => {
        const left = mark.at - time;
        const at = onScreen(mark.spot, minimap.box);
        return (
          <span key={`${mark.id}@${mark.at}`} className="overlay__pin" data-soon={left <= 30 || undefined} data-ours={mark.ours ?? undefined} style={{ left: at.left, top: at.top }} title={mark.label}>
            {left <= 0 ? t("Şimdi") : clock(left)}
          </span>
        );
      })}
    </>
  );
}
