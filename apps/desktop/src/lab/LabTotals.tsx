import type { LibraryData } from "../library/data";
import { STAT_PRICES } from "../data/itemGold";
import { useT } from "../i18n";
import type { LabColumn } from "./columns";
import { barShare, shownStats, statValue, sumStats, type StatTotals } from "./totals";

const fullBuild = (column: LabColumn) => [...column.build.coreItems, ...column.build.items];

/** Stat totals of each column's full build as bars on one scale per stat; the numbers are printed too. */
export function LabTotals({ columns, data }: { columns: LabColumn[]; data: LibraryData }) {
  const t = useT();
  const totals: StatTotals[] = columns.map((c) => sumStats(fullBuild(c), data.details));
  const keys = shownStats(totals);
  if (keys.length === 0) return null;
  return (
    <section className="lab__totals" aria-label={t("Toplam değerler")}>
      <h2 className="draft__heading">{t("Toplam değerler")}</h2>
      <p className="build__note">{t("Eşya değerleri toplanır. Delme, beceri hızı ve her şeyi çalma Data Dragon'da yok, burada gösterilmez.")}</p>
      <table className="lab__table">
        <thead>
          <tr>
            <th scope="col">{t("Değer")}</th>
            {columns.map((c, i) => (
              <th key={i} scope="col">
                {c.id === "direction" && c.style ? t(c.style) : t(c.label)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key}>
              <th scope="row">{t(STAT_PRICES[key].label)}</th>
              {columns.map((_, i) => (
                <td key={i}>
                  <span className="lab__bar" aria-hidden="true">
                    <span data-column={i} style={{ width: `${barShare(totals, key, i)}%` }} />
                  </span>
                  <span className="lab__value">
                    {statValue(key, totals[i][key] ?? 0)}
                    {STAT_PRICES[key].percent ? "%" : ""}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
