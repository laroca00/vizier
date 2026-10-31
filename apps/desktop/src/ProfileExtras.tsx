import { useState } from "react";
import { getChampionPool, getLpHistory, type LpSnapshot } from "./api";
import { championIconUrl, type Champion } from "./data/ddragon";
import { formatPercent, useLang, useT } from "./i18n";
import { tierLabel } from "./labels";
import { useAsync } from "./useAsync";

const SHOWN = 5;

export function ChampionPool({ puuid, version, champions }: { puuid: string; version: string; champions: Map<number, Champion> }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`pool:${puuid}`, () => getChampionPool(puuid));
  if (state.status !== "done" || state.value.champions.length === 0) return null;
  const { games, champions: pool } = state.value;

  return (
    <section aria-label={t("Şampiyon havuzu")}>
      <h3 className="profile__heading">{t("Şampiyon havuzu, son {games} dereceli maç", { games })}</h3>
      <ul className="pool">
        {pool.slice(0, SHOWN).map((c) => {
          const champion = champions.get(c.championId);
          const kda = (c.kills + c.assists) / Math.max(1, c.deaths);
          return (
            <li key={c.championId}>
              {champion && <img src={championIconUrl(version, champion.id)} alt="" width={28} height={28} />}
              <span className="pool__name">{champion?.name ?? c.championId}</span>
              <span className="pool__games">{t("{games} maç", { games: c.games })}</span>
              <span className="pool__rate">{formatPercent(c.wins / c.games, lang)}</span>
              <span className="pool__kda">{t("{kda} KDA", { kda: kda.toFixed(1) })}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const WIDTH = 480;
const HEIGHT = 110;
const PAD = { top: 14, right: 8, bottom: 8, left: 8 };

export function LpHistory({ puuid }: { puuid: string }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`lp:${puuid}`, () => getLpHistory(puuid));
  const [hover, setHover] = useState<number | null>(null);
  if (state.status !== "done") return null;
  const points = state.value;

  return (
    <section aria-label={t("LP geçmişi")}>
      <h3 className="profile__heading">{t("LP geçmişi, Tek/Çift")}</h3>
      {points.length < 2 ? (
        <p className="profile__empty">{t("Vizier LP'ni profil her açıldığında kaydediyor. Birkaç maç sonra değişim burada çizilecek.")}</p>
      ) : (
        <LpChart points={points} hover={hover} onHover={setHover} lang={lang} />
      )}
    </section>
  );
}

function LpChart({ points, hover, onHover, lang }: { points: LpSnapshot[]; hover: number | null; onHover: (i: number | null) => void; lang: "tr" | "en" }) {
  const t = useT();
  const values = points.map((p) => p.points);
  const lo = Math.min(...values);
  const hi = Math.max(...values, lo + 50);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - ((v - lo) / (hi - lo)) * innerH;
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const first = points[0];
  const last = points[points.length - 1];
  const label = (p: LpSnapshot) => `${tierLabel(p.tier, p.rank, lang)}, ${p.lp} LP`;
  const change = last.points - first.points;
  const shown = hover !== null ? points[hover] : null;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - box.left) / box.width) * WIDTH;
    onHover(Math.max(0, Math.min(points.length - 1, Math.round(((at - PAD.left) / innerW) * (points.length - 1)))));
  }

  const summary = t("{from} seviyesinden {to} seviyesine, {change} LP.", {
    from: label(first),
    to: label(last),
    change: `${change > 0 ? "+" : change < 0 ? "−" : ""}${Math.abs(change)}`,
  });

  return (
    <figure className="lp">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="lp__plot" role="img" aria-label={summary} onPointerMove={onMove} onPointerLeave={() => onHover(null)}>
        <path d={line} className="lp__line" />
        <circle cx={x(points.length - 1)} cy={y(last.points)} r={4} className="lp__dot" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="cs__cursor" />
            <circle cx={x(hover)} cy={y(values[hover])} r={4} className="lp__dot" />
          </g>
        )}
      </svg>
      <figcaption className="cs__caption" aria-live="polite">
        {shown ? `${new Date(shown.at).toLocaleDateString(lang === "tr" ? "tr" : "en-GB")}: ${label(shown)}` : summary}
      </figcaption>
    </figure>
  );
}
