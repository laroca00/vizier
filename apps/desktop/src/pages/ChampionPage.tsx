import { RankPicker, RegionPicker } from "../ui/RankPicker";
import { rankLabel, useBracket } from "../rank";
import { BuildEvolution } from "../patches/BuildEvolutionView";
import { ChampionHistory } from "../patches/ChampionHistory";
import { formatPercent, useLang, useT, type Lang } from "../i18n";
import { useState } from "react";
import { getChampion, getCounters, getSynergies, getTierList, type ChampionOverview, type Counters } from "../api";
import { BuildSuggestion } from "../BuildSuggestion";
import { Abilities, ChampionReference, ChampionTitle, StrengthsWeaknesses } from "../ChampionGuide";
import { JournalNote, MatchupNotes } from "../Journal";
import { MatchupLink } from "../matchupLink";
import { SkinGallery } from "../SkinGallery";
import { similarChampions } from "../similar";
import { difficultyOf } from "../draft/logic";
import { DifficultyPanel } from "../draft/DifficultyPanel";
import { groupAllies, MIN_ALLY_GAMES } from "../synergy";
import { championNoteKey, inPool, matchupNoteKey, toggleFavouriteChampion, togglePool, usePersonal } from "../personal";
import { ProBuildList } from "../ProBuildList";
import { championIconUrl, champions, latestVersion, roleIconUrl, type Champion } from "../data/ddragon";
import { POSITIONS } from "../labels";
import { ARENA, AUGMENT_QUEUES, QUEUES, RANKED, winLabel } from "../queues";
import { ArenaItems } from "../draft/ArenaItems";
import { ChampionAugmentBoard } from "../augments/ChampionAugmentBoard";
import "../augments/augments.css";
import { LiquidGlass } from "../ui/LiquidGlass";
import { SplashLayers, useSkinSplash, useSplashUrl } from "../ui/Splash";
import { useAsync } from "../useAsync";
import { ChampionSummaryCard } from "./ChampionSummaryCard";
import { RankCurvePanel } from "./RankCurvePanel";
import { LengthPanel } from "./LengthPanel";
import { JunglePanel } from "./JunglePanel";
import { ObjectivePanel } from "./ObjectivePanel";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { ComboSection } from "../combos/ComboSection";
import { Tabs } from "../ui/Tabs";
import { DataBadge } from "../ui/DataBadge";
import { sampleTitle } from "../ui/sampleTitle";
import { pooled } from "../data/confidence";
import { SegmentBar } from "../charts";
import { MatchupGuide } from "../draft/MatchupGuide";
import { Select } from "../ui/Fields";
import { ChampionWorkspace } from "../workspace/ChampionWorkspace";
import "./ChampionPage.css";
import "../ui/EloTag.css";

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
  onOpenBuild?: (buildId: string) => void;
  onOpenMatchup?: (championId: number, opponentId: number, position: string) => void;
};

export function ChampionPage({ championId, initialPosition = null, initialQueue = RANKED, onOpenChampion, onOpenBuild, onOpenMatchup }: Props) {
  const t = useT();
  const lang = useLang();
  const [position, setPosition] = useState<string | null>(initialPosition);
  const [queue, setQueue] = useState(initialQueue);
  const [view, setView] = useState<"info" | "workspace">("info");
  const [data] = useAsync("static", loadStatic);
  const bracket = useBracket();
  const [state, retry] = useAsync(`${queue}:${championId}:${position}:${bracket}`, () => getChampion(championId, position, queue));
  const queueLabel = t(QUEUES.find((q) => q.id === queue)?.label ?? "");
  const champion = data.status === "done" ? data.value.champions.get(championId) : undefined;
  const version = data.status === "done" ? data.value.version : null;
  const splash = useSkinSplash(champion?.id);
  useSplashUrl(splash);
  const personal = usePersonal();
  const pooled = inPool(personal, championId);

  return (
    <LiquidGlass
      className="panel champion"
      radius={28}
      strength={2.5}
      scroll
      backdrop={<SplashLayers className="champion__banner" url={splash} />}
    >
      <header className="champion__header enter">
        {champion && version && <img className="champion__portrait" src={championIconUrl(version, champion.id)} alt="" width={64} height={64} />}
        <div>
          <h1 className="champion__name">{champion?.name ?? t("Şampiyon")}</h1>
          {champion && <ChampionTitle champion={champion} />}
          {state.status === "done" && state.value && (
            <p className="detail__meta">
              {t("Yama {patch}, {rank} {scope}, {games} maç", {
                rank: rankLabel(bracket, lang === "en" ? "en" : "tr"),
                patch: state.value.patches[0],
                scope: queue === RANKED ? t(POSITIONS[state.value.position ?? ""] ?? "").toLocaleLowerCase(lang) : queueLabel,
                games: state.value.games,
              })}
              {" "}
              <DataBadge games={state.value.games} winRate={state.value.winRate} patches={state.value.patches} updatedAt={state.value.updatedAt} ranked source={t("Vizier crawler, dereceli maçlar")} />
            </p>
          )}
          <Tabs className="champion__queues" size="small" label={t("Oyun modu")} items={QUEUES.map((q) => ({ id: q.id, label: t(q.label) }))} value={queue} onChange={setQueue} />
          {queue === RANKED && <RankPicker />}
          {queue === RANKED && <RegionPicker />}
        </div>
        <button
          type="button"
          className="star champion__star"
          aria-pressed={personal.favourites.includes(championId)}
          onClick={() => toggleFavouriteChampion(championId)}
        >
          {personal.favourites.includes(championId) ? t("Favorilerde") : t("Favorilere ekle")}
        </button>
        <button
          type="button"
          className="star"
          aria-pressed={pooled}
          onClick={() => togglePool(championId, state.status === "done" ? (state.value?.position ?? position) : position)}
        >
          {pooled ? t("Havuzunda") : t("Havuzuna ekle")}
        </button>
      </header>

      {state.status === "error" ? (
        <ErrorState message={t("Şampiyon istatistikleri alınamadı. Vizier sunucusuna şu an ulaşılamıyor.")} onRetry={retry} />
      ) : state.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : !state.value ? (
        <EmptyState title={t("Yeterli maç yok")}>
          {t("{champion} için {mode} modunda henüz yeterli maç yok. Vizier her gün daha fazla maç topluyor.", {
            champion: champion?.name ?? t("Bu şampiyon"),
            mode: queueLabel,
          })}
        </EmptyState>
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
      {AUGMENT_QUEUES.includes(queue) && <ChampionAugmentBoard championId={championId} championName={champion?.name ?? ""} queue={queue} />}
      {queue === ARENA && <ArenaItems championId={championId} />}

      {champion && version && (
        <Tabs className="champion__queues" size="small" label={t("Görünüm")} items={[{ id: "info" as const, label: t("Bilgi") }, { id: "workspace" as const, label: t("Çalışma alanım") }]} value={view} onChange={setView} />
      )}
      {champion && version && view === "workspace" && data.status === "done" && (
        <ChampionWorkspace
          champion={champion}
          champions={data.value.champions}
          onOpenBuild={(id) => onOpenBuild?.(id)}
          onOpenMatchup={(opponentId) => onOpenMatchup?.(championId, opponentId, position ?? "MIDDLE")}
        />
      )}
      {champion && version && view === "info" && (
        <div className="champion__body champion__reference">
          <section className="enter" aria-label={t("Yetenekler")}>
            <h2 className="draft__heading">{t("Yetenekler")}</h2>
            <Abilities champion={champion} version={version} />
          </section>
          <div>
            <StrengthsWeaknesses champion={champion} />
            <ComboSection champion={champion} version={version} />
            <DifficultyPanel champion={champion} />
            <ChampionReference champion={champion} />
            <ChampionHistory championKey={championId} championName={champion.name} />
            <SkinGallery champion={champion} />
            <JournalNote noteKey={championNoteKey(championId)} label={t("{champion} notların", { champion: champion.name })} />
            {data.status === "done" && <MatchupNotes championId={championId} champions={data.value.champions} version={version} />}
          </div>
        </div>
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
  // A lane opponent to prepare for outside champ select; it resets with the role.
  const [opponent, setOpponent] = useState<number | null>(null);
  const [opponentRole, setOpponentRole] = useState(position);
  if (opponentRole !== position) {
    setOpponentRole(position);
    setOpponent(null);
  }
  const ranked = queue === RANKED && position !== null;
  // A role with a handful of games is someone's troll pick, not a way to play the champion.
  const roles = overview.positions.filter((p) => p.games >= MIN_ROLE_GAMES || p.position === position);
  return (
    <>
      {ranked && roles.length > 1 && (
        <Tabs
          label={t("Rol")}
          size="small"
          items={roles.map((p) => ({
            id: p.position,
            icon: <img className="role-icon" src={roleIconUrl(p.position)} alt="" width={16} height={16} />,
            label: (
              <>
                {t(POSITIONS[p.position])} <span className="champion__share">{percent(p.share).replace(/\.0(?=%|$)/, "")}</span>
              </>
            ),
          }))}
          value={position}
          onChange={onPosition}
        />
      )}

      {ranked && roles.length > 1 && (
        <SegmentBar
          label={t("Rollere göre oynanma")}
          segments={roles.slice(0, 5).map((p) => ({ key: p.position, label: t(POSITIONS[p.position]), value: p.share, icon: roleIconUrl(p.position) }))}
          format={(n) => percent(n).replace(/\.0(?=%|$)/, "")}
        />
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
          <dd>
            {percent(overview.winRate)}
            {/* The API ranks a champion from 100 games; below that the rate is shown but flagged. */}
            {overview.games < 100 && <span className="champion__thin">{t("{games} maçtan, henüz güvenilir değil", { games: overview.games })}</span>}
          </dd>
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

      {ranked && position && version && <ChampionSummaryCard championId={championId} position={position} version={version} champions={champions} />}

      <div className="champion__body">
        <section className="enter" aria-label="Build">
          <div className="champion__build-head">
            <h2 className="draft__heading">{t("Build")}</h2>
            {ranked && position && <OpponentSelect championId={championId} position={position} champions={champions} value={opponent} onChange={setOpponent} />}
          </div>
          {opponent && position && version && champions.get(opponent) && (
            <MatchupGuide championId={championId} position={position} opponent={champions.get(opponent)!} version={version} />
          )}
          <BuildSuggestion
            championId={championId}
            championName={championName}
            position={position}
            currentSpells={[0, 0]}
            locked={false}
            vs={ranked ? opponent : null}
            showPros={ranked && opponent !== null}
            inDraft={false}
            queue={queue}
          />
        </section>
        {ranked && overview.lengths && <LengthPanel lengths={overview.lengths} patches={overview.patches} updatedAt={overview.updatedAt} />}
        {ranked && overview.jungle && <JunglePanel jungle={overview.jungle} patches={overview.patches} updatedAt={overview.updatedAt} />}
        {ranked && overview.objectives && <ObjectivePanel objectives={overview.objectives} winRate={overview.winRate} patches={overview.patches} updatedAt={overview.updatedAt} />}
        {ranked && position && <RankCurvePanel championId={championId} position={position} />}
        {ranked && position && version && <BuildEvolution key={`${championId}:${position}`} championId={championId} position={position} version={version} />}
        {ranked && (
          <section className="enter champion__pros" aria-label={t("Pro maçları")}>
            <h2 className="draft__heading">{t("Pro'lar bu şampiyonu nasıl oynadı")}</h2>
            <ProBuildList
              filter={{ championId, position: position ?? undefined, limit: 12 }}
              preferOpponent={opponent}
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
            <SimilarList
              championId={championId}
              position={position}
              champions={champions}
              version={version}
              onOpenChampion={(id) => onOpenChampion(id, position, queue)}
            />
          </div>
        )}
      </div>
    </>
  );
}

/** Every lane opponent with enough games in this role, by name. */
function OpponentSelect({
  championId,
  position,
  champions,
  value,
  onChange,
}: {
  championId: number;
  position: string;
  champions: Map<number, Champion>;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`${championId}:${position}:${useBracket()}`, () => getCounters(championId, position));
  if (state.status !== "done" || state.value.matchups.length === 0) return null;
  const options = state.value.matchups
    .map((m) => champions.get(m.championId))
    .filter((c): c is Champion => c !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, lang))
    .map((c) => ({ value: String(c.key), label: c.name }));
  return (
    <Select
      label={t("Rakibe hazırlan")}
      value={value === null ? "" : String(value)}
      options={[{ value: "", label: t("Rakip seçilmedi") }, ...options]}
      onChange={(v) => onChange(v ? Number(v) : null)}
    />
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
  const [state, retry] = useAsync(`${championId}:${position}:${useBracket()}`, () => getCounters(championId, position));
  return (
    <section className="enter" aria-label={t("Eşleşmeler")}>
      {state.status === "error" ? (
        <ErrorState message={t("Eşleşmeler alınamadı.")} onRetry={retry} />
      ) : state.status !== "done" ? null : state.value.matchups.length < 2 ? (
        <>
          <h2 className="draft__heading">{t("Eşleşmeler")}</h2>
          <p className="build__note">{t("Koridor rakiplerine göre ayırmak için henüz yeterli maç yok.")}</p>
        </>
      ) : (
        <Matchups counters={state.value} championId={championId} position={position} champions={champions} version={version} onOpenChampion={onOpenChampion} />
      )}
    </section>
  );
}

function Matchups({ counters, champions, version, onOpenChampion, championId, position }: { counters: Counters } & CounterProps) {
  const lang = useLang();
  const percent = percentIn(lang);
  const t = useT();
  const personal = usePersonal();
  const all = counters.matchups;
  const shown = Math.min(SHOWN_MATCHUPS, Math.floor(all.length / 2));
  // A matchup is listed as hard or easy only when its interval clears 50%; a group with none collapses.
  const groups = [
    { title: "Zorlandığı rakipler", list: all.slice(0, shown).filter((m) => difficultyOf(m.winRate, m.games) === "hard") },
    { title: "Rahat ettiği rakipler", list: all.slice(-shown).reverse().filter((m) => difficultyOf(m.winRate, m.games) === "easy") },
  ].filter((group) => group.list.length > 0);
  // Bars share one scale so a 40% and a 60% matchup look equally far from even.
  const spread = Math.max(...all.map((m) => Math.abs(m.winRate - 0.5)), 0.05);

  return groups.map((group) => (
    <div key={group.title} className="matchups">
      <h2 className="draft__heading">{t(group.title)}</h2>
      <p className="section-badge">
        <DataBadge {...pooled(group.list)} patches={counters.patches} updatedAt={counters.updatedAt} ranked source={t("Vizier crawler, dereceli maçlar")} />
      </p>
      <ul className="matchups__list">
        {group.list.map((m, i) => {
          const opponent = champions.get(m.championId);
          const lean = (m.winRate - 0.5) / spread;
          return (
            <li key={m.championId}>
              <button type="button" className="matchups__open" onClick={() => onOpenChampion(m.championId)}>
                {opponent && version && <img src={championIconUrl(version, opponent.id)} alt="" width={26} height={26} />}
                <span className="matchups__name">{opponent?.name ?? m.championId}</span>
                {personal.notes[matchupNoteKey(championId, m.championId)] && (
                  <span className="matchups__note" role="img" aria-label={t("Notun var")} title={personal.notes[matchupNoteKey(championId, m.championId)]}>
                    ✎
                  </span>
                )}
              </button>
              <span className="matchups__bar" aria-hidden="true">
                <span style={{ "--size": `${Math.abs(lean) * 50}%`, "--i": i } as React.CSSProperties} data-side={lean < 0 ? "loss" : "win"} />
              </span>
              <span className="matchups__rate">{percent(m.winRate)}</span>
              <span className="matchups__games" title={sampleTitle(t, lang, { ...m, patches: counters.patches, updatedAt: counters.updatedAt })}>
                {t("{games} maç", { games: m.games })}
              </span>
              <MatchupLink championId={championId} opponentId={m.championId} position={position} />
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

const SHOWN_SIMILAR = 5;
// Not a rate cut-off: only champions people actually play are worth listing as similar.
const SIMILAR_MIN_GAMES = 100;

/**
 * Champions with the same main class and damage type and the closest level-one
 * stats, with their role's tier and win rate where they have enough games.
 */
function SimilarList({ championId, position, champions, version, onOpenChampion }: CounterProps) {
  const percent = percentIn(useLang());
  const t = useT();
  const [state] = useAsync(`tiers:${position}:${useBracket()}`, () => getTierList(position));
  const self = champions.get(championId);
  if (state.status !== "done" || !self) return null;
  const played = new Map(state.value.champions.filter((e) => e.games >= SIMILAR_MIN_GAMES).map((e) => [e.championId, e]));
  const similar = similarChampions(self, [...champions.values()].filter((c) => played.has(c.key)), SHOWN_SIMILAR);
  if (similar.length === 0) return null;
  return (
    <section className="matchups" aria-label={t("Benzer şampiyonlar")}>
      <h2 className="draft__heading">{t("Bu rolde benzer şampiyonlar")}</h2>
      <ul className="matchups__list matchups__list--plain">
        {similar.map((c) => {
          const e = played.get(c.key)!;
          return (
            <li key={c.key}>
              <button type="button" className="matchups__open" onClick={() => onOpenChampion(c.key)}>
                {version && <img src={championIconUrl(version, c.id)} alt="" width={26} height={26} />}
                <span className="matchups__name">{c.name}</span>
              </button>
              <span className="matchups__games">{t("{tier} tier", { tier: e.tier })}</span>
              <span className="matchups__rate">{percent(e.winRate)}</span>
              <span className="matchups__games">{t("{games} maç", { games: e.games })}</span>
            </li>
          );
        })}
      </ul>
      <p className="build__note">{t("Aynı sınıf ve hasar türü, en yakın temel statlar.")}</p>
    </section>
  );
}

function AllyList({
  championId,
  position,
  champions,
  version,
  onOpenChampion,
}: Omit<CounterProps, "onOpenChampion"> & { onOpenChampion: (championId: number, position: string) => void }) {
  const lang = useLang();
  const percent = percentIn(lang);
  const t = useT();
  const [state] = useAsync(`allies:${championId}:${position}:${useBracket()}`, () => getSynergies(championId, position));
  if (state.status !== "done") return null;
  const groups = groupAllies(state.value.allies, position);
  if (groups.length === 0) return null;
  return (
    <section className="matchups" aria-label={t("Takım arkadaşları")}>
      <h2 className="draft__heading">{t("En iyi anlaştığı takım arkadaşları")}</h2>
      <p className="section-badge">
        <DataBadge {...pooled(groups.flatMap((g) => g.allies))} patches={state.value.patches} updatedAt={state.value.updatedAt} ranked source={t("Vizier crawler, dereceli maçlar")} />
      </p>
      {groups.map((group) => (
        <div key={group.position}>
          <p className="build__stat">
            {t(POSITIONS[group.position] ?? "")}
            {group.duo && ` · ${t("ikili")}`}
          </p>
          <ul className="matchups__list matchups__list--plain">
            {group.allies.map((a) => {
              const ally = champions.get(a.championId);
              return (
                <li key={`${a.championId}-${a.position}`}>
                  <button type="button" className="matchups__open" onClick={() => onOpenChampion(a.championId, a.position)}>
                    {ally && version && <img src={championIconUrl(version, ally.id)} alt="" width={26} height={26} />}
                    <span className="matchups__name">{ally?.name ?? a.championId}</span>
                  </button>
                  <span className="matchups__rate">{percent(a.winRate)}</span>
                  <span className="matchups__games" title={sampleTitle(t, lang, { ...a, patches: state.value.patches, updatedAt: state.value.updatedAt })}>
                    {t("{games} maç", { games: a.games })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <p className="build__note">{t("{games} maçtan azı gösterilmez.", { games: MIN_ALLY_GAMES })}</p>
    </section>
  );
}
