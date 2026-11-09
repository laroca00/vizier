import { getBuild, getCounters } from "../api";
import { championIconUrl, itemIconUrl, items as loadItems, runes, runeIconUrl, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { useOpenChampion } from "../championLink";
import { championSummary } from "./championSummary";

const KEYS = ["", "Q", "W", "E"];

/** The champion page in one row: keystone, core items, skill max order, hardest and easiest lane. */
export function ChampionSummaryCard({
  championId,
  position,
  version,
  champions,
}: {
  championId: number;
  position: string;
  version: string;
  champions: Map<number, Champion>;
}) {
  const t = useT();
  const lang = useLang();
  const openChampion = useOpenChampion();
  const [state] = useAsync(`summary:${championId}:${position}`, async () => {
    const [build, counters, styles, items] = await Promise.all([
      getBuild(championId, position).catch(() => null),
      getCounters(championId, position).catch(() => null),
      runes().catch(() => null),
      loadItems().catch(() => null),
    ]);
    const runeById = new Map([...(styles?.values() ?? [])].flatMap((s) => s.slots.flat().map((r) => [r.id, r] as const)));
    return { summary: championSummary(build, counters), runeById, items };
  });
  if (state.status !== "done" || !state.value.summary) return null;
  const { summary, runeById, items } = state.value;
  const keystone = summary.keystone ? runeById.get(summary.keystone) : undefined;
  const matchup = (label: string, m: NonNullable<typeof summary.hardest>, tone: "bad" | "good") => {
    const c = champions.get(m.championId);
    if (!c) return null;
    return (
      <button type="button" className="summary__cell summary__matchup" data-tone={tone} onClick={() => openChampion(c.key, position, 420)}>
        <span className="summary__label">{t(label)}</span>
        <span className="summary__value">
          <img src={championIconUrl(version, c.id)} alt="" width={28} height={28} />
          <span>
            {c.name}
            <span className="summary__sub">{t("{rate}, {games} maç", { rate: formatPercent(m.winRate, lang), games: m.games })}</span>
          </span>
        </span>
      </button>
    );
  };
  return (
    <section className="summary enter" aria-label={t("Kısa özet")}>
      {keystone && (
        <div className="summary__cell">
          <span className="summary__label">{t("Ana rün")}</span>
          <span className="summary__value">
            <img src={runeIconUrl(keystone.icon)} alt="" width={30} height={30} />
            {keystone.name}
          </span>
        </div>
      )}
      {summary.core.length > 0 && (
        <div className="summary__cell">
          <span className="summary__label">{t("Çekirdek eşyalar")}</span>
          <span className="summary__value summary__items">
            {summary.core.map((id) => (
              <img key={id} src={itemIconUrl(version, id)} alt={items?.get(id)?.name ?? ""} title={items?.get(id)?.name} width={30} height={30} />
            ))}
          </span>
        </div>
      )}
      {summary.maxOrder.length > 0 && (
        <div className="summary__cell">
          <span className="summary__label">{t("Yetenek önceliği")}</span>
          <span className="summary__value summary__keys">
            {summary.maxOrder.map((slot, i) => (
              <kbd key={slot} data-first={i === 0 || undefined}>
                {KEYS[slot]}
              </kbd>
            ))}
          </span>
        </div>
      )}
      {summary.hardest && matchup("En zor rakip", summary.hardest, "bad")}
      {summary.easiest && matchup("En rahat rakip", summary.easiest, "good")}
    </section>
  );
}
