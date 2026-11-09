import { BRACKET_LABELS } from "@vizier/shared/brackets";
import { getCoverage } from "../api";
import { coverageRows, PLATFORMS } from "../data/coverageRows";
import { useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import "./CoverageTable.css";

/** Ranked games behind the stats, per rank bracket and platform, from the published coverage doc. */
export function CoverageTable() {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync("coverage", getCoverage);
  const table = state.status === "done" ? coverageRows(state.value) : null;
  if (!table) return null;

  return (
    <div className="coverage">
      <h3>{t("Ligler ve maç sayıları")}</h3>
      <table className="coverage__table">
        <caption>{t("Yama {patch}, dereceli tek/çift maçları", { patch: table.patch })}</caption>
        <thead>
          <tr>
            <th scope="col">{t("Lig")}</th>
            {PLATFORMS.map((p) => (
              <th key={p} scope="col">
                {p === "TR1" ? "TR" : p === "EUW1" ? "EUW" : "KR"}
              </th>
            ))}
            <th scope="col">{t("Toplam")}</th>
            <th scope="col">{t("Zaman çizelgeli")}</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.bracket}>
              <th scope="row">{BRACKET_LABELS[row.bracket][lang === "en" ? "en" : "tr"]}</th>
              {PLATFORMS.map((p) => (
                <td key={p}>{row.platforms[p].toLocaleString()}</td>
              ))}
              <td>{row.games.toLocaleString()}</td>
              <td>{row.timelineShare === null ? "–" : `%${Math.round(row.timelineShare * 100)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
