import { championIconUrl } from "../../data/ddragon";
import type { WidgetContext } from "./context";

const clock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

// Enemy Flashes the player marked with the hotkeys, counting down to when they're back.
export function FlashWidget({ t, flashes, time, version, championName }: WidgetContext) {
  if (flashes.length === 0) return null;
  return (
    <section className="overlay__card overlay__flashes">
      <p className="overlay__caption">{t("Rakip Flash")}</p>
      {flashes.map((f) => {
        const left = f.backAt - time;
        return (
          <p key={f.slot} className="overlay__row overlay__flash" data-ready={left <= 0 || undefined}>
            <span className="overlay__flash-who">
              {version && <img src={championIconUrl(version, f.champion)} alt="" width={22} height={22} />}
              {championName(f.champion)}
            </span>
            <span className="overlay__value">{left <= 0 ? t("Hazır") : clock(left)}</span>
          </p>
        );
      })}
    </section>
  );
}
