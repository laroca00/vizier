import { useState } from "react";
import { getChampion } from "../api";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { winRateShift } from "./winRateShift";

function Shift({ championId }: { championId: number }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`shift:${championId}`, () => getChampion(championId, null));
  if (state.status === "loading" || state.status === "idle") return <span className="build__stat">{t("Kazanma oranı yükleniyor")}</span>;
  const shift = state.status === "done" ? winRateShift(state.value) : null;
  if (!shift) return <span className="build__stat">{t("Kazanma oranı farkı için yeterli maç yok")}</span>;
  return (
    <span className="build__stat">
      {t("Kazanma oranı: {before} → {after}, son yama {games} maç", { before: formatPercent(shift.before, lang, 1), after: formatPercent(shift.after, lang, 1), games: shift.games })}
    </span>
  );
}

/** A changed champion's win rate before and after the patch; loads on its own for pool champions and on request for the rest. */
export function WinRateShift({ championId, auto }: { championId: number; auto: boolean }) {
  const t = useT();
  const [asked, setAsked] = useState(false);
  if (auto || asked) return <Shift championId={championId} />;
  return (
    <button type="button" className="link" onClick={() => setAsked(true)}>
      {t("Kazanma oranına bak")}
    </button>
  );
}
