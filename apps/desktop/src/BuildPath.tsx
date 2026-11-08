import type { ItemTimes, Picks } from "./api";
import { buildPath } from "./buildPath";
import { itemIconUrl, type Item } from "./data/ddragon";
import { formatPercent, intlLocale, useLang, useT } from "./i18n";

const LABELS = { start: "Başlangıç", core: "Ana eşyalar", later: "Sonra en sık" } as const;

function timesLine(times: (ItemTimes[number] | undefined)[]) {
  if (times.length === 0 || times.some((t) => !t)) return null;
  const known = times as ItemTimes[number][];
  return { minutes: known.map((t) => Math.round(t.minute)).join(", "), games: Math.min(...known.map((t) => t.games)) };
}

/** Start, core and later items as one path, each step with the games behind it. */
export function BuildPath({ picks, items, version, times = {} }: { picks: Pick<Picks, "startItems" | "coreItems" | "items">; items: Map<number, Item>; version: string; times?: ItemTimes }) {
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
                    title={times[item.id] ? t("{item}: ortalama {minute}. dakika, {games} maç", { item: info?.name ?? "", minute: times[item.id].minute, games: times[item.id].games }) : step.key === "later" ? t("{item}: {rate} kazanma, {games} maç", { item: info?.name ?? "", rate: formatPercent(item.winRate, lang), games: item.games }) : info?.name}
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
            {step.key === "core" && timesLine(step.items.map((i) => times[i.id])) && (
              <p className="build__note path__meta">{t("Tamamlanma: {minutes}. dakika, en az {games} maç", timesLine(step.items.map((i) => times[i.id]))!)}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
