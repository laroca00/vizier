import { useState } from "react";
import type { Build, Picks } from "./api";
import { STYLE_NAMES } from "./buildStyles";
import { itemIconUrl, runeIconUrl, type Item, type RuneStyle } from "./data/ddragon";
import { formatPercent, useLang, useT } from "./i18n";
import { sideBySide, winRateBar } from "./buildSideBySide";
import { Tabs } from "./ui/Tabs";

type Sort = "popular" | "winrate";

/** Fewer games than this and a win rate is mostly noise, so it is flagged. */
export const THIN_GAMES = 50;

type Props = {
  build: Build;
  picks: Picks;
  version: string;
  runes: Map<number, RuneStyle>;
  items: Map<number, Item>;
};

/**
 * The alternatives behind the suggestion: each build style, rune page and
 * finished item with its own games and win rate, sortable by either.
 */
export function BuildCompare({ build, picks, version, runes, items }: Props) {
  const t = useT();
  const lang = useLang();
  const [sort, setSort] = useState<Sort>("popular");
  const percent = (n: number) => formatPercent(n, lang, 1);
  // A win-rate sort only ranks choices with enough games to mean something.
  const floor = winRateBar(build.games);
  const order = <T extends { games: number; winRate: number }>(list: T[]) =>
    sort === "popular" ? [...list].sort((a, b) => b.games - a.games) : list.filter((x) => x.games >= floor).sort((a, b) => b.winRate - a.winRate);

  const runeById = new Map([...runes.values()].flatMap((s) => s.slots.flat().map((r) => [r.id, r] as const)));
  const finished = picks.items.filter((i) => items.get(i.id)?.complete);
  const variants = build.variants ?? [];

  const rate = (x: { games: number; winRate: number }) => (
    <td data-thin={x.games < THIN_GAMES || undefined} title={x.games < THIN_GAMES ? t("{games} maçtan, henüz güvenilir değil", { games: x.games }) : undefined}>
      {percent(x.winRate)}
    </td>
  );

  return (
    <details className="build__block build__compare">
      <summary className="build__stat">{t("Build karşılaştırması")}</summary>
      <SideBySide build={build} version={version} items={items} />
      <Tabs
        label={t("Sıralama")}
        size="small"
        items={[
          { id: "popular" as const, label: t("En popüler") },
          { id: "winrate" as const, label: t("En yüksek kazanma") },
        ]}
        value={sort}
        onChange={setSort}
      />
      {sort === "winrate" && <p className="build__note">{t("En az {games} maçta denenmiş seçenekler.", { games: floor })}</p>}

      {variants.length >= 2 && (
        <table className="compare">
          <thead>
            <tr>
              <th>{t("Build türü")}</th>
              <th>{t("Maç")}</th>
              <th>{t("Pay")}</th>
              <th>{t("Kazanma")}</th>
            </tr>
          </thead>
          <tbody>
            {order(variants).map((v) => (
              <tr key={v.style}>
                <td>{t(STYLE_NAMES[v.style])}</td>
                <td>{v.games}</td>
                <td>{formatPercent(v.share, lang)}</td>
                {rate(v)}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <table className="compare">
        <thead>
          <tr>
            <th>{t("Rün sayfası")}</th>
            <th>{t("Maç")}</th>
            <th>{t("Kazanma")}</th>
          </tr>
        </thead>
        <tbody>
          {order(picks.runes)
            .slice(0, 5)
            .map((page) => {
              const keystone = runeById.get(page.perks[0]);
              const sub = runes.get(page.subStyle);
              return (
                <tr key={page.perks.join("-")}>
                  <td>
                    <span className="compare__name">
                      {keystone && <img src={runeIconUrl(keystone.icon)} alt="" width={22} height={22} />}
                      {keystone?.name}
                      {sub && <img src={runeIconUrl(sub.icon)} alt={sub.name} title={sub.name} width={16} height={16} />}
                    </span>
                  </td>
                  <td>{page.games}</td>
                  {rate(page)}
                </tr>
              );
            })}
        </tbody>
      </table>

      <table className="compare">
        <thead>
          <tr>
            <th>{t("Eşya")}</th>
            <th>{t("Maç")}</th>
            <th>{t("Kazanma")}</th>
          </tr>
        </thead>
        <tbody>
          {order(finished)
            .slice(0, 10)
            .map((item) => (
              <tr key={item.id}>
                <td>
                  <span className="compare__name">
                    <img src={itemIconUrl(version, item.id)} alt="" width={22} height={22} />
                    {items.get(item.id)?.name}
                  </span>
                </td>
                <td>{item.games}</td>
                {rate(item)}
              </tr>
            ))}
        </tbody>
      </table>
    </details>
  );
}

const COLUMN_TITLES = {
  popular: "En popüler build",
  winrate: "En yüksek kazanma",
  ap: "Büyü hasarı ağırlıklı takıma karşı",
  ad: "Fiziksel hasar ağırlıklı takıma karşı",
  tank: "Tank ağırlıklı takıma karşı",
} as const;

/** The popular build, the best win rate and the answers to AP, AD and tank teams, with the games behind each. */
function SideBySide({ build, version, items }: { build: Build; version: string; items: Map<number, Item> }) {
  const t = useT();
  const lang = useLang();
  const { columns, bar, sameAsPopular } = sideBySide(build);
  if (columns.length < 2 && !sameAsPopular) return null;
  return (
    <section className="side" aria-label={t("Yan yana")}>
      <ul className="side__cols">
        {columns.map((c) => (
          <li key={c.id} className="side__col">
            <span className="build__stat">{t(COLUMN_TITLES[c.id])}</span>
            {c.style && <span className="build__style-meta">{t(STYLE_NAMES[c.style])}</span>}
            <span className="side__items">
              {c.items.map((id) => (
                <img key={id} src={itemIconUrl(version, id)} alt={items.get(id)?.name ?? ""} title={items.get(id)?.name} width={28} height={28} />
              ))}
            </span>
            <span className="build__style-meta" data-thin={c.games < THIN_GAMES || undefined}>
              {c.winRate === null
                ? t("{games} maç", { games: c.games })
                : t("{games} maç, {rate} kazanma", { games: c.games, rate: formatPercent(c.winRate, lang, 1) })}
            </span>
          </li>
        ))}
      </ul>
      <p className="build__note">
        {sameAsPopular ? t("En popüler build aynı zamanda en çok kazanan. ") : ""}
        {t("En yüksek kazanma için en az {games} maç aranır.", { games: bar })}
      </p>
    </section>
  );
}
