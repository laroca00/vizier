import { runeIconUrl, type RuneStyle } from "./data/ddragon";
import { formatPercent, useLang, useT } from "./i18n";
import { splitPage, treeRows, type TreeRow } from "./runeView";
import "./runes.css";

type Props = {
  primary: RuneStyle | undefined;
  secondary: RuneStyle | undefined;
  perks: number[];
  /** The champion's per-rune counts and games; leave out when the page is not the overall one. */
  counts?: { id: number; games: number }[];
  total: number;
};

function Tree({ style, rows, keystone }: { style: RuneStyle; rows: TreeRow[]; keystone: boolean }) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="runes__tree">
      <p className="runes__style">
        <img src={runeIconUrl(style.icon)} alt="" width={20} height={20} />
        {style.name}
      </p>
      {rows.map((row, i) => (
        <ul key={i} className="runes__row" data-keystone={(keystone && i === 0) || undefined}>
          {row.map((cell) => (
            <li
              key={cell.rune.id}
              data-chosen={cell.chosen || undefined}
              title={cell.rate === null ? cell.rune.name : t("{rune}: {rate} seçilme, {games} maç", { rune: cell.rune.name, rate: formatPercent(cell.rate, lang), games: cell.games ?? 0 })}
            >
              <img src={runeIconUrl(cell.rune.icon)} alt={cell.rune.name} width={keystone && i === 0 ? 44 : 32} height={keystone && i === 0 ? 44 : 32} loading="lazy" />
              {cell.rate !== null && <span>{formatPercent(cell.rate, lang, 0)}</span>}
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}

/** Both trees laid out like the client: chosen runes lit, the rest dimmed with how often they were taken. */
export function RunePageView({ primary, secondary, perks, counts, total }: Props) {
  const { primary: main, secondary: side } = splitPage(perks);
  if (!primary || !secondary) return null;
  return (
    <div className="runes">
      <Tree style={primary} rows={treeRows(primary, new Set(main), counts, total)} keystone />
      <Tree style={secondary} rows={treeRows(secondary, new Set(side), counts, total, true)} keystone={false} />
    </div>
  );
}
