import { championIconUrl } from "../../data/ddragon";
import type { WidgetContext } from "./context";

const OBJECTIVE_NAMES = { baron: "Baron", dragon: "Ejder" } as const;

// Dead players on both sides, soonest back first, and a line when the count opens a window.
export function WindowWidget({ t, opportunity, time, version, championName }: WidgetContext) {
  const { fallen, window } = opportunity;
  const alive = fallen.filter((f) => f.backAt > time);
  if (alive.length === 0) return null;
  const line = !window
    ? null
    : window.kind === "push"
      ? window.open.length > 0
        ? t("{n} rakip ölü, {s} sn: {objectives} açık", { n: window.down, s: window.seconds, objectives: window.open.map((o) => t(OBJECTIVE_NAMES[o])).join(", ") })
        : t("{n} rakip ölü, {s} sn", { n: window.down, s: window.seconds })
      : t("{n} takım arkadaşın ölü, {s} sn", { n: window.down, s: window.seconds });
  return (
    <section className="overlay__card overlay__window" data-kind={window?.kind}>
      {line && <p className="overlay__window-line">{line}</p>}
      <ul className="overlay__fallen">
        {alive.map((f) => (
          <li key={`${f.champion}:${f.ours}`} data-ours={f.ours}>
            {version ? <img src={championIconUrl(version, f.champion)} alt={championName(f.champion)} width={26} height={26} /> : <span>{championName(f.champion)}</span>}
            <span className="overlay__value">{Math.ceil(f.backAt - time)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
