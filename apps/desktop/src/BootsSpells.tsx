import type { Picks } from "./api";
import { comparisonRows } from "./comparison";
import { itemIconUrl, spellIconUrl, type Item, type SummonerSpell } from "./data/ddragon";
import { formatPercent, useLang, useT } from "./i18n";

type Props = { picks: Pick<Picks, "spells" | "items">; total: number; items: Map<number, Item>; spells: Map<number, SummonerSpell>; version: string };

/** Boots and summoner spell pairs side by side: how often each is taken and how it does. */
export function BootsSpells({ picks, total, items, spells, version }: Props) {
  const t = useT();
  const lang = useLang();
  const boots = comparisonRows(
    picks.items.filter((i) => items.get(i.id)?.boots),
    total,
    4,
  );
  const pairs = comparisonRows(picks.spells, total, 4);
  if (boots.length < 2 && pairs.length < 2) return null;

  const table = (label: string, rows: { key: string; cells: React.ReactNode; pickRate: number; winRate: number; games: number }[]) => (
    <table className="duel comparison__table">
      <caption className="visually-hidden">{label}</caption>
      <thead>
        <tr>
          <th scope="col">{label}</th>
          <th scope="col">{t("Seçilme")}</th>
          <th scope="col">{t("Kazanma")}</th>
          <th scope="col">{t("Maç")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.cells}</th>
            <td>{formatPercent(row.pickRate, lang, 1)}</td>
            <td>{formatPercent(row.winRate, lang, 1)}</td>
            <td>{row.games.toLocaleString(lang === "tr" ? "tr" : "en-GB")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <section className="build__block comparison" aria-label={t("Botlar ve büyüler")}>
      {boots.length >= 2 &&
        table(
          t("Botlar"),
          boots.map((r) => ({
            key: String(r.entry.id),
            cells: (
              <span className="comparison__name">
                <img src={itemIconUrl(version, r.entry.id)} alt="" width={24} height={24} loading="lazy" />
                {items.get(r.entry.id)?.name}
              </span>
            ),
            ...r,
          })),
        )}
      {pairs.length >= 2 &&
        table(
          t("Büyüler"),
          pairs.map((r) => ({
            key: r.entry.ids.join(","),
            cells: (
              <span className="comparison__name">
                {r.entry.ids.map((id) => {
                  const spell = spells.get(id);
                  return spell ? <img key={id} src={spellIconUrl(version, spell.id)} alt={spell.name} title={spell.name} width={24} height={24} loading="lazy" /> : null;
                })}
              </span>
            ),
            ...r,
          })),
        )}
    </section>
  );
}
