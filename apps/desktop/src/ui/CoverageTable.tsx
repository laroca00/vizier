import { BRACKET_LABELS } from "@vizier/shared/brackets";
import { getCoverage } from "../api";
import { coverageRows, droppedGames, PLATFORMS, roleFixedGames, statusRows } from "../data/coverageRows";
import { ageText } from "../data/freshness";
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
  const dropped = state.status === "done" ? droppedGames(state.value, table.patch) : null;
  const status = state.status === "done" ? statusRows(state.value) : null;
  const gamesToday = state.status === "done" ? state.value.gamesToday : undefined;
  const fixed = state.status === "done" ? roleFixedGames(state.value, table.patch) : 0;

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
      {dropped && (
        <p className="build__note">
          {t("Sayılmayan maç: {remake} yeniden başlatma, {left} oyuncu çıkışı{share}", {
            remake: dropped.surrender.toLocaleString(),
            left: dropped.afk.toLocaleString(),
            share: dropped.share === null ? "" : ` (%${(dropped.share * 100).toFixed(1)})`,
          })}
        </p>
      )}
      {fixed > 0 && <p className="build__note">{t("Rolü Smite, çiftlik ve harita konumundan tamamlanan maç: {games}", { games: fixed.toLocaleString() })}</p>}
      {(status || gamesToday !== undefined) && (
        <>
          <h3>{t("Veri durumu")}</h3>
          {gamesToday !== undefined && <p className="build__note">{t("Son 24 saatte oynanan dereceli maç: {games}", { games: gamesToday.toLocaleString() })}</p>}
          {status && (
            <table className="coverage__table">
              <caption>{t("Her ligin verisi en son ne zaman yayınlandı")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("Lig")}</th>
                  <th scope="col">{t("Son yayın")}</th>
                  <th scope="col">{t("Durum")}</th>
                </tr>
              </thead>
              <tbody>
                {status.map((row) => (
                  <tr key={row.bracket}>
                    <th scope="row">{BRACKET_LABELS[row.bracket][lang === "en" ? "en" : "tr"]}</th>
                    <td>{ageText(t, row.lastPublishAt ?? undefined) ?? "–"}</td>
                    <td title={row.held.join("\n")}>{row.held.length > 0 ? t("Tutuldu: veri kontrolden geçmedi") : t("Yayında")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
