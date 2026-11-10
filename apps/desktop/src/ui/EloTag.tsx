import { useCallback } from "react";
import { getRankCurve } from "../api";
import { eloTagFor, ELO_TAG_TEXT } from "../data/eloShift";
import type { CurveVerdict } from "../data/rankCurve";
import { useT } from "../i18n";
import { useAsync } from "../useAsync";
import "./EloTag.css";

/** Looks up elo tags from the one small rank-curve document; every lookup is null until it has loaded. */
export function useEloTags() {
  const [curve] = useAsync("rank-curve", getRankCurve);
  const doc = curve.status === "done" ? curve.value : null;
  return useCallback((championId: number, position: string) => (doc ? eloTagFor(doc, championId, position) : null), [doc]);
}

export function EloTag({ verdict }: { verdict: Exclude<CurveVerdict, null> | null }) {
  const t = useT();
  if (!verdict) return null;
  return (
    <span className="elo-tag" data-verdict={verdict} title={t("Alt ve üst rankın kazanma oranı aralıkları birbirine değmiyor.")}>
      {t(ELO_TAG_TEXT[verdict])}
    </span>
  );
}
