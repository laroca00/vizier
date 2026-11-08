import type { Picks } from "./api";
import { buildPath } from "./buildPath";
import { itemIconUrl, type Item } from "./data/ddragon";
import { formatPercent, intlLocale, useLang, useT } from "./i18n";

const LABELS = { start: "Başlangıç", core: "Ana eşyalar", later: "Sonra en sık" } as const;

/** Start, core and later items as one path, each step with the games behind it. */
export function BuildPath({ picks, items, version }: { picks: Pick<Picks, "startItems" | "coreItems" | "items">; items: Map<number, Item>; version: string }) {
  const t = useT();
  const lang = useLang();
  const steps = buildPath(picks, (id) => !!items.get(id)?.complete);
  if (steps.length === 0) return null;
  return (
    <section className="build__block" aria-label={t("Eşya yolu")}>
      <ol className="path">
        {steps.map((step) => (
          <li key={step.key} className="path__step">
            <p className="build__stat path__label">{t(LABELS[step.key])}</p>
            <div className="build__row">
              {step.items.map((item, i) => {
                const info = items.get(item.id);
                return (
                  <img
                    key={`${item.id}-${i}`}
                    src={itemIconUrl(version, item.id)}
                    alt={info?.name ?? ""}
                    title={step.key === "later" ? t("{item}: {rate} kazanma, {games} maç", { item: info?.name ?? "", rate: formatPercent(item.winRate, lang), games: item.games }) : info?.name}
                    width={28}
                    height={28}
                  />
                );
              })}
            </div>
            <p className="build__note path__meta">
              {step.winRate !== null
                ? t("{games} maç, {rate} kazanma", { games: step.games, rate: formatPercent(step.winRate, lang) })
                : t("{games} maça kadar", { games: step.games })}
              {step.key === "core" &&
                ` · ${t("toplam {gold} altın", { gold: step.items.reduce((sum, i) => sum + (items.get(i.id)?.gold ?? 0), 0).toLocaleString(intlLocale(lang)) })}`}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
