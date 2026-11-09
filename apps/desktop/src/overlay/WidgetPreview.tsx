import { useT } from "../i18n";
import { useSettings } from "../settings";
import { rootVars, widgetVars } from "./appearance";
import type { WidgetId } from "./registry";
import "./overlay.css";
import "./WidgetPreview.css";

/** A small still of each widget with made-up numbers, drawn with the overlay's own card styles. */
export function WidgetPreview({ id }: { id: WidgetId }) {
  const t = useT();
  const settings = useSettings();
  return (
    <div className="widget-preview" aria-hidden="true" style={{ ...rootVars(settings.overlayTheme, 1), ...widgetVars(settings.overlayWidgetStyles[id]) }}>
      <div className="overlay__zoom">
      {id === "skill" && (
        <section className="overlay__card overlay__skill">
          <span className="overlay__key">Q</span>
          <span>{t("yükselt")}</span>
        </section>
      )}
      {id === "skillOrder" && (
        <section className="overlay__card">
          <p className="overlay__skillstrip">
            {["Q", "W", "E", "Q", "Q", "R", "Q", "W"].map((k, i) => (
              <span key={i} data-done={i < 3 || undefined}>
                {k}
              </span>
            ))}
          </p>
        </section>
      )}
      {id === "build" && (
        <section className="overlay__card overlay__build">
          <ol className="overlay__build-items">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} data-owned={n < 3 || undefined}>
                <span className="widget-preview__icon" />
              </li>
            ))}
          </ol>
          <p className="overlay__row">
            <span>Rabadon</span>
            <span className="overlay__value">{t("{gold} altın kaldı", { gold: 640 })}</span>
          </p>
        </section>
      )}
      {id === "reference" && (
        <section className="overlay__card">
          <p className="overlay__skillstrip">
            {["Q", "W", "E", "Q", "Q", "R"].map((k, i) => (
              <span key={i} data-done={i < 2 || undefined}>
                {k}
              </span>
            ))}
          </p>
          <p className="overlay__row">
            <span>Q → AA → W</span>
            <span className="overlay__value">{t("Kombo")}</span>
          </p>
          <p className="overlay__row">
            <span>{t("Eşleşme notu")}</span>
            <span className="overlay__value">···</span>
          </p>
        </section>
      )}
      {id === "next" && (
        <section className="overlay__card overlay__next">
          <span className="widget-preview__icon" />
          <span className="overlay__next-text">
            <span className="overlay__caption">{t("Sıradaki eşya")}</span>
            <span>Rabadon</span>
            <span className="overlay__target">{t("{gold} altın kaldı", { gold: 640 })}</span>
          </span>
        </section>
      )}
      {id === "timers" && (
        <section className="overlay__card">
          <p className="overlay__row">
            <span>{t("Ejder")}</span>
            <span className="overlay__value">2:37</span>
          </p>
          <p className="overlay__row">
            <span>{t("Baron")}</span>
            <span className="overlay__value">5:57</span>
          </p>
        </section>
      )}
      {id === "minimap" && (
        <section className="overlay__card widget-preview__minimap">
          <span className="overlay__pin widget-preview__pin" style={{ left: "68%", top: "66%" }}>
            2:37
          </span>
          <span className="overlay__pin widget-preview__pin" data-soon style={{ left: "30%", top: "30%" }}>
            0:24
          </span>
        </section>
      )}
      {id === "items" && (
        <section className="overlay__card">
          <p className="overlay__caption">{t("Eşya altını farkı")}</p>
          <p className="overlay__row" data-ahead="true">
            <span>{t("Koridor rakibine göre")}</span>
            <span className="overlay__value">+1.2k</span>
          </p>
          <p className="overlay__row" data-ahead="false">
            <span>{t("Takım")}</span>
            <span className="overlay__value">−0.8k</span>
          </p>
        </section>
      )}
      {id === "bench" && (
        <section className="overlay__card">
          <p className="overlay__caption">{t("Karşılaştırma")}</p>
          <p className="overlay__row" data-ahead="true">
            <span>{t("Minyon, ortalama {cs}", { cs: 62 })}</span>
            <span className="overlay__value">+8</span>
          </p>
          <p className="overlay__row" data-ahead="false">
            <span>{t("Seviye, ortalama {level}", { level: 6.5 })}</span>
            <span className="overlay__value">−0.5</span>
          </p>
          <p className="overlay__row">
            <span>{t("K/D/A, ortalama {kda}", { kda: "1.2/0.9/1.8" })}</span>
            <span className="overlay__value">2/1/3</span>
          </p>
          <p className="overlay__row" data-ahead="true">
            <span>{t("Kill katılımı, ortalama %{kp}", { kp: 52 })}</span>
            <span className="overlay__value">%60</span>
          </p>
        </section>
      )}
      {id === "augments" && (
        <section className="overlay__card overlay__augments">
          <p className="overlay__caption">{t("En iyi augment'ler")}</p>
          <div className="overlay__augment-group" data-rarity="2">
            <ol>
              <li>
                <span className="overlay__augment-tier" data-tier="S">
                  S
                </span>
                ···
              </li>
              <li>
                <span className="overlay__augment-tier" data-tier="A">
                  A
                </span>
                ···
              </li>
            </ol>
          </div>
        </section>
      )}
      {id === "window" && (
        <section className="overlay__card overlay__window" data-kind="push">
          <p className="overlay__window-line">{t("{n} rakip ölü, {s} sn: {objectives} açık", { n: 2, s: 19, objectives: t("Ejder") })}</p>
          <ul className="overlay__fallen">
            <li data-ours="false">
              <span className="widget-preview__icon" />
              <span className="overlay__value">19</span>
            </li>
            <li data-ours="false">
              <span className="widget-preview__icon" />
              <span className="overlay__value">27</span>
            </li>
          </ul>
        </section>
      )}
      {id === "spikes" && (
        <section className="overlay__card overlay__spikes">
          <p className="overlay__spike" data-lane>
            <span className="widget-preview__icon" />
            <span>{t("{champion} {level}. seviye", { champion: "Zed", level: 6 })}</span>
            <span className="overlay__spike-ult">R</span>
          </p>
        </section>
      )}
      {id === "scoreboard" && (
        <ol className="overlay__scoreboard widget-preview__rows">
          <li data-ahead="true">+0.9k</li>
          <li data-ahead="false">−1.4k</li>
          <li data-ahead="true">+0.2k</li>
        </ol>
      )}
      {id === "scoreboard" && (
        <p className="overlay__scoreboard-total" data-ahead="true">
          <span>{t("Takım")}</span>
          <span className="overlay__value">+0.5k</span>
        </p>
      )}
      </div>
    </div>
  );
}
