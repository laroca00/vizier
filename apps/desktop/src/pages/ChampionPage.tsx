import { formatPercent, useLang, useT, type Lang } from "../i18n";
import { useState } from "react";
import { getChampion, getCounters, getSynergies, type ChampionOverview, type Counters } from "../api";
import { BuildSuggestion } from "../BuildSuggestion";
import { ProBuildList } from "../ProBuildList";
import { championIconUrl, champions, latestVersion, type Champion } from "../data/ddragon";
import { POSITIONS } from "../labels";
import { QUEUES, RANKED, winLabel } from "../queues";
import { LiquidGlass } from "../ui/LiquidGlass";
import { useAsync } from "../useAsync";

const SHOWN_MATCHUPS = 5;
const MIN_ROLE_GAMES = 10;
const percentIn = (lang: Lang) => (n: number) => formatPercent(n, lang, 1);
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n * 100).toFixed(1)}`;

async function loadStatic() {
  const [version, byKey] = await Promise.all([latestVersion(), champions()]);
  return { version, champions: byKey };
}

type Props = {
  championId: number;
  /** The role to open on; the most played one when null. */
  initialPosition?: string | null;
  initialQueue?: number;
  onOpenChampion: (championId: number, position: string | null, queue: number) => void;
};

export function ChampionPage({ championId, initialPosition = null, initialQueue = RANKED, onOpenChampion }: Props) {
  const t = useT();
  const lang = useLang();
  const [position, setPosition] = useState<string | null>(initialPosition);
  const [queue, setQueue] = useState(initialQueue);
  const [data] = useAsync("static", loadStatic);
  const [state, retry] = useAsync(`${queue}:${championId}:${position}`, () => getChampion(championId, position, queue));
  const queueLabel = t(QUEUES.find((q) => q.id === queue)?.label ?? "");
  const champion = data.status === "done" ? data.value.champions.get(championId) : undefined;
  const version = data.status === "done" ? data.value.version : null;

  return (
    <LiquidGlass className="panel champion" radius={28} strength={2.5}>
      <header className="champion__header enter">
        {champion && version && <img className="champion__portrait" src={championIconUrl(version, champion.id)} alt="" width={64} height={64} />}
        <div>
          <h1 className="champion__name">{champion?.name ?? t("Şampiyon")}</h1>
          {state.status === "done" && state.value && (
            <p className="detail__meta">
              {t("Yama {patch}, Emerald+ {scope}, {games} maç", {
                patch: state.value.patches[0],
                scope: queue === RANKED ? t(POSITIONS[state.value.position ?? ""] ?? "").toLocaleLowerCase(lang) : queueLabel,
                games: state.value.games,
              })}
            </p>
          )}
        </div>
      </header>

      <div className="tiers__tabs enter" role="tablist" aria-label={t("Oyun modu")}>
        {QUEUES.map((q) => (
          <button key={q.id} type="button" role="tab" aria-selected={q.id === queue} className="nav__item" onClick={() => setQueue(q.id)}>
            {t(q.label)}
          </button>
        ))}
      </div>

      {state.status === "error" ? (
        <div role="alert">
          <p className="coach__note">{t("Şampiyon istatistikleri alınamadı. Vizier sunucusuna şu an ulaşılamıyor.")}</p>
          <button type="button" className="button" onClick={retry}>
            {t("Tekrar dene")}
          </button>
        </div>
      ) : state.status !== "done" ? (
        <p className="coach__note" aria-live="polite">
          {t("Yükleniyor")}
        </p>
      ) : !state.value ? (
        <p className="coach__note">
          {t("{champion} için {mode} modunda henüz yeterli maç yok. Vizier her gün daha fazla maç topluyor.", {
            champion: champion?.name ?? t("Bu şampiyon"),
            mode: queueLabel,
          })}
        </p>
      ) : (
        <Overview
          overview={state.value}
          championId={championId}
          championName={champion?.name ?? ""}
          champions={data.status === "done" ? data.value.champions : new Map()}
          version={version}
          queue={queue}
          onPosition={setPosition}
          onOpenChampion={onOpenChampion}
        />
      )}
    </LiquidGlass>
  );
}

type OverviewProps = {
  overview: ChampionOverview;
  championId: number;
  championName: string;
  champions: Map<number, Champion>;
  version: string | null;
  queue: number;
  onPosition: (position: string) => void;
  onOpenChampion: (championId: number, position: string | null, queue: number) => void;
};

function Overview({ overview, championId, championName, champions, version, queue, onPosition, onOpenChampion }: OverviewProps) {
  const percent = percentIn(useLang());
  const t = useT();
  const position = overview.position;
  const ranked = queue === RANKED && position !== null;
  // A role with a handful of games is someone's troll pick, not a way to play the champion.
  const roles = overview.positions.filter((p) => p.games >= MIN_ROLE_GAMES || p.position === position);
  return (
    <>
      {ranked && roles.length > 1 && (
        <div className="tiers__tabs enter" role="tablist" aria-label={t("Rol")}>
          {roles.map((p) => (
            <button
              key={p.position}
              type="button"
              role="tab"
              aria-selected={p.position === position}
              className="nav__item"
              onClick={() => onPosition(p.position)}
            >
              {t(POSITIONS[p.position])} <span className="champion__share">{percent(p.share).replace(/\.0(?=%|$)/, "")}</span>
            </button>
          ))}
        </div>
      )}

      <dl className="figures enter">
        <div>
          <dt>Tier</dt>
          <dd>
            {overview.tier ? (
              <span className="tier" data-tier={overview.tier}>
                {overview.tier}
              </span>
            ) : (
              "–"
            )}
          </dd>
        </div>
        <div>
          <dt>{t(winLabel(queue))}</dt>
          <dd>{percent(overview.winRate)}</dd>
        </div>
        <div>
          <dt>{t("Geçen yamaya göre")}</dt>
          <dd data-trend={overview.winRateChange == null ? undefined : overview.winRateChange >= 0 ? "up" : "down"}>
            {overview.winRateChange == null ? "–" : t("{change} puan", { change: signed(overview.winRateChange) })}
          </dd>
        </div>
        <div>
          <dt>{t("Seçilme")}</dt>
          <dd>{percent(overview.pickRate)}</dd>
        </div>
        {overview.banRate != null && (
          <div>
            <dt>{t("Yasaklanma")}</dt>
            <dd>{percent(overview.banRate)}</dd>
          </div>
        )}
      </dl>

      <div className="champion__body">
        <section className="enter" aria-label="Build">
          <h2 className="draft__heading">{t("Build")}</h2>
          <BuildSuggestion
            championId={championId}
            championName={championName}
            position={position}
            currentSpells={[0, 0]}
            locked={false}
            vs={null}
            inDraft={false}
            queue={queue}
          />
        </section>
        {ranked && (
          <section className="enter champion__pros" aria-label={t("Pro maçları")}>
            <h2 className="draft__heading">{t("Pro'lar bu şampiyonu nasıl oynadı")}</h2>
            <ProBuildList
              filter={{ championId, limit: 6 }}
              compact
              emptyText={t("Worlds oyuncularının bu şampiyonla son 30 günde solo kuyruk maçı yok.")}
            />
          </section>
        )}
        {ranked && (
          <div>
            <CounterLists
              championId={championId}
              position={position}
              champions={champions}
              version={version}
              onOpenChampion={(id) => onOpenChampion(id, position, queue)}
            />
            <AllyList
              championId={championId}
              position={position}
              champions={champions}
              version={version}
              onOpenChampion={(id, role) => onOpenChampion(id, role, queue)}
            />
          </div>
        )}
      </div>
    </>
  );
}

type CounterProps = {
  championId: number;
  position: string;
  champions: Map<number, Champion>;
  version: string | null;
  onOpenChampion: (championId: number) => void;
};

function CounterLists({ championId, position, champions, version, onOpenChampion }: CounterProps) {
  const t = useT();
  const [state, retry] = useAsync(`${championId}:${position}`, () => getCounters(championId, position));
  return (
    <section className="enter" aria-label={t("Eşleşmeler")}>
      {state.status === "error" ? (
        <div role="alert">
          <p className="coach__note">{t("Eşleşmeler alınamadı.")}</p>
          <button type="button" className="button" onClick={retry}>
            {t("Tekrar dene")}
          </button>
        </div>
      ) : state.status !== "done" ? null : state.value.matchups.length < 2 ? (
        <>
          <h2 className="draft__heading">{t("Eşleşmeler")}</h2>
          <p className="build__note">{t("Koridor rakiplerine göre ayırmak için henüz yeterli maç yok.")}</p>
        </>
      ) : (
        <Matchups counters={state.value} champions={champions} version={version} onOpenChampion={onOpenChampion} />
      )}
    </section>
  );
}

function Matchups({ counters, champions, version, onOpenChampion }: { counters: Counters } & Omit<CounterProps, "championId" | "position">) {
  const percent = percentIn(useLang());
  const t = useT();
  const all = counters.matchups;
  const shown = Math.min(SHOWN_MATCHUPS, Math.floor(all.length / 2));
  const groups = [
    { title: "Zorlandığı rakipler", list: all.slice(0, shown) },
    { title: "Rahat ettiği rakipler", list: all.slice(-shown).reverse() },
  ];
  // Bars share one scale so a 40% and a 60% matchup look equally far from even.
  const spread = Math.max(...all.map((m) => Math.abs(m.winRate - 0.5)), 0.05);

  return groups.map((group) => (
    <div key={group.title} className="matchups">
      <h2 className="draft__heading">{t(group.title)}</h2>
      <ul className="matchups__list">
        {group.list.map((m, i) => {
          const opponent = champions.get(m.championId);
          const lean = (m.winRate - 0.5) / spread;
          return (
            <li key={m.championId}>
              <button type="button" className="matchups__open" onClick={() => onOpenChampion(m.championId)}>
                {opponent && version && <img src={championIconUrl(version, opponent.id)} alt="" width={26} height={26} />}
                <span className="matchups__name">{opponent?.name ?? m.championId}</span>
              </button>
              <span className="matchups__bar" aria-hidden="true">
                <span style={{ "--size": `${Math.abs(lean) * 50}%`, "--i": i } as React.CSSProperties} data-side={lean < 0 ? "loss" : "win"} />
              </span>
              <span className="matchups__rate">{percent(m.winRate)}</span>
              <span className="matchups__games">{t("{games} maç", { games: m.games })}</span>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

const SHOWN_ALLIES = 5;

function AllyList({
  championId,
  position,
  champions,
  version,
  onOpenChampion,
}: Omit<CounterProps, "onOpenChampion"> & { onOpenChampion: (championId: number, position: string) => void }) {
  const percent = percentIn(useLang());
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`allies:${championId}:${position}`, () => getSynergies(championId, position));
  if (state.status !== "done" || state.value.allies.length === 0) return null;
  return (
    <section className="matchups" aria-label={t("Takım arkadaşları")}>
      <h2 className="draft__heading">{t("En iyi anlaştığı takım arkadaşları")}</h2>
      <ul className="matchups__list matchups__list--plain">
        {state.value.allies.slice(0, SHOWN_ALLIES).map((a) => {
          const ally = champions.get(a.championId);
          return (
            <li key={`${a.championId}-${a.position}`}>
              <button type="button" className="matchups__open" onClick={() => onOpenChampion(a.championId, a.position)}>
                {ally && version && <img src={championIconUrl(version, ally.id)} alt="" width={26} height={26} />}
                <span className="matchups__name">{ally?.name ?? a.championId}</span>
              </button>
              <span className="matchups__games">{t(POSITIONS[a.position] ?? "").toLocaleLowerCase(lang)}</span>
              <span className="matchups__rate">{percent(a.winRate)}</span>
              <span className="matchups__games">{t("{games} maç", { games: a.games })}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
