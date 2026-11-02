import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getBenchmarks, getBuild, getPace, getTrends, type Benchmarks, type Build, type Habit, type Pace, type Picks } from "../api";
import { readChosenStyle } from "../buildStyles";
import { champions, itemIconUrl, items, latestVersion, type Item } from "../data/ddragon";
import { overlayFixture, scoutingFixture } from "../dev/fixtures";
import { platformOf, type LcuStatus, type Platform } from "../lcu";
import { formatPercent, setClientLocale, useLang, useT, type Params } from "../i18n";
import { positionLabel } from "../labels";
import { useSettings } from "../settings";
import { useAsync } from "../useAsync";
import {
  championKey,
  clock,
  findMe,
  GOAL_METRICS,
  goalProgress,
  itemDifference,
  myNumbers,
  nextItem,
  nextSkill,
  objectiveTimers,
  paceAt,
  scoreboardRows,
  type GoalMetric,
  type LiveGame,
  type Timer,
} from "./live";
import { ROW_GAP, SCOREBOARD_SPOT, useLayout, type Spot, type WidgetId } from "./layout";
import { sampleGame } from "./sample";
import { Scouting } from "./Scouting";
import { TimerCard } from "./Timers";
import "./overlay.css";

/** Subscribes to a value the Rust side reports through an event, and a getter command for its current value. */
function useBackendFlag<T>(command: string | null, event: string, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    if (!isTauri()) return;
    if (command) invoke<T>(command).then(setValue, () => {});
    const off = listen<T>(event, (e) => setValue(e.payload));
    return () => {
      off.then((stop) => stop());
    };
  }, [command, event]);
  return value;
}

function useClientLocale() {
  useEffect(() => {
    if (!isTauri()) return;
    invoke<LcuStatus>("lcu_status").then(
      (status) => setClientLocale(status.state === "connected" ? (status.region?.locale ?? null) : null),
      () => {},
    );
  }, []);
}

function usePlayer(active: boolean) {
  const [player, setPlayer] = useState<{ puuid: string; platform: Platform } | null>(null);
  useEffect(() => {
    if (!active || !isTauri()) return;
    invoke<LcuStatus>("lcu_status").then(
      (status) =>
        setPlayer(
          status.state === "connected" && status.summoner ? { puuid: status.summoner.puuid, platform: platformOf(status.region) } : null,
        ),
      () => {},
    );
  }, [active]);
  return player;
}

/**
 * The game clock only arrives once a second; this counts down between
 * updates so timers don't tick in visible jumps.
 */
function useGameClock(game: LiveGame | null) {
  const [now, setNow] = useState(() => performance.now());
  const [anchor, setAnchor] = useState({ gameTime: 0, at: performance.now() });
  useEffect(() => {
    if (game) setAnchor({ gameTime: game.gameTime, at: performance.now() });
  }, [game?.gameTime]);
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return anchor.gameTime + Math.min(1.5, (now - anchor.at) / 1000);
}

type Static = {
  version: string;
  championIds: Map<string, number>;
  items: Map<number, Item>;
};

async function loadStatic(): Promise<Static> {
  const [version, byKey, itemList] = await Promise.all([latestVersion(), champions(), items()]);
  return { version, championIds: new Map([...byKey.values()].map((c) => [c.id, c.key])), items: itemList };
}

type Helpers = { build: Build | null; benchmarks: Benchmarks | null; pace: Pace | null };

async function loadHelpers(championId: number, position: string): Promise<Helpers> {
  // Either can be missing for a rare pick; the panels that need it just stay hidden.
  const [build, benchmarks, pace] = await Promise.all([
    getBuild(championId, position).catch(() => null),
    getBenchmarks(position, championId).catch(() => null),
    getPace(position, championId).catch(() => null),
  ]);
  return { build, benchmarks, pace };
}

const median = (benchmarks: Benchmarks | null, metric: string) => benchmarks?.metrics[metric]?.quantiles[10] ?? null;
const thousands = (gold: number) => `${gold > 0 ? "+" : gold < 0 ? "−" : ""}${(Math.abs(gold) / 1000).toFixed(1)}k`;

/** The build the player picked on the build page, else the most played style. */
function picksFor(build: Build | null, championId: number, position: string): Picks | null {
  if (!build) return null;
  const chosen = readChosenStyle(championId, position);
  const variants = build.variants ?? [];
  return variants.find((v) => v.style === chosen) ?? (variants.length >= 2 ? variants[0] : build);
}

const GOAL_LABELS: Record<GoalMetric, string> = {
  cs10: "10. dakikada {target} minyon",
  cs_pm: "Dakikada {target} minyon",
  vision_pm: "Dakikada {target} görüş skoru",
  kill_participation: "Skora katkı en az {target}",
  deaths: "En fazla {target} ölüm",
};

export function Overlay() {
  useClientLocale();
  const t = useT();
  const lang = useLang();
  const liveGame = useBackendFlag<LiveGame | null>("live_game", "live-game", overlayFixture());
  const loading = useBackendFlag("live_loading", "live-loading", scoutingFixture() !== null);
  const hidden = useBackendFlag("overlay_hidden", "overlay-toggle", false);
  const editing = useBackendFlag("overlay_editing", "overlay-edit", new URLSearchParams(location.search).has("edit"));
  const tabHeld = useBackendFlag(null, "overlay-scoreboard", false);
  const { layout, preview, save, reset } = useLayout();
  // Arranging the boxes before a game uses a made-up one.
  const game = liveGame ?? (editing ? sampleGame() : null);
  const player = usePlayer(loading || liveGame !== null);
  const settings = useSettings();
  const time = useGameClock(game);
  const [data] = useAsync(game ? "static" : null, loadStatic);
  const me = game ? findMe(game) : undefined;
  const championId = me && data.status === "done" ? (data.value.championIds.get(championKey(me)) ?? null) : null;
  // Positions are empty outside Summoner's Rift; builds and benchmarks are per role.
  const position = me?.position || null;
  const [helpers] = useAsync(championId && position ? `${championId}:${position}` : null, () => loadHelpers(championId!, position!));
  const [trends] = useAsync(player && settings.overlayGoal ? `trends:${player.puuid}` : null, () => getTrends(player!.puuid));

  if (hidden || !settings.overlay) return null;
  if (loading && !editing) {
    return settings.overlayScouting ? (
      <div className="overlay" aria-hidden="true">
        <Scouting player={player} fixture={scoutingFixture()} />
      </div>
    ) : null;
  }
  if (!game || !me) return null;
  const extra = helpers.status === "done" ? helpers.value : { build: null, benchmarks: null, pace: null };
  const itemInfo = data.status === "done" ? data.value.items : null;
  const gold = (id: number) => itemInfo?.get(id)?.gold ?? 0;
  const picks = championId && position ? picksFor(extra.build, championId, position) : null;

  const skill = settings.overlaySkills ? nextSkill(game.level, game.skills, picks?.skills ?? null) : null;
  const timers = settings.overlayObjectives ? objectiveTimers(game, me.team) : [];
  const numbers = settings.overlayBenchmarks && position ? myNumbers(game) : null;
  const paceTarget = settings.overlayPace && extra.pace ? paceAt(extra.pace.median, time / 60) : null;
  const itemGold = settings.overlayItems && itemInfo ? itemDifference(game, gold) : null;

  const buildItems = picks ? [...new Set([...(picks.coreItems?.ids ?? []), ...picks.items.map((i) => i.id)])].filter((id) => itemInfo?.get(id)?.complete) : [];
  const next = settings.overlayNextItem && itemInfo ? nextItem(me.items.map((i) => i.itemId), buildItems) : null;
  const habit = settings.overlayGoal && trends.status === "done" ? firstTrackable(trends.value.habits, game) : null;
  const rows = settings.overlayScoreboard && itemInfo && (tabHeld || editing) ? scoreboardRows(game, gold) : [];

  const boxes: { id: WidgetId; name: string; node: ReactNode }[] = [];
  if (skill)
    boxes.push({
      id: "skill",
      name: t("Yetenek önerisi"),
      node: (
        <section className="overlay__card overlay__skill">
          <span className="overlay__key">{skill}</span>
          <span>{t("yükselt")}</span>
        </section>
      ),
    });
  if (next && data.status === "done") {
    const info = data.value.items.get(next);
    const missing = Math.max(0, gold(next) - (game.gold ?? 0));
    boxes.push({
      id: "next",
      name: t("Sıradaki eşya"),
      node: (
        <section className="overlay__card overlay__next">
          <img src={itemIconUrl(data.value.version, next)} alt="" width={34} height={34} />
          <span className="overlay__next-text">
            <span className="overlay__caption">{t("Sıradaki eşya")}</span>
            <span>{info?.name}</span>
            <span className="overlay__target">{missing > 0 ? t("{gold} altın kaldı", { gold: missing }) : t("Alabilirsin")}</span>
          </span>
        </section>
      ),
    });
  }
  if (habit) boxes.push({ id: "goal", name: t("Koçun hedefi"), node: <GoalCard habit={habit} game={game} /> });
  // The card hides itself when it has nothing to count; manual timers live inside it.
  if (timers.length > 0 || settings.overlayTimers)
    boxes.push({
      id: "timers",
      name: t("Süreler"),
      node: <TimerCard objectives={timers} objectiveLabel={(timer) => timerLabel(timer, t)} game={game} time={time} />,
    });
  if (numbers && (numbers.csPerMinute !== null || numbers.killParticipation !== null))
    boxes.push({
      id: "benchmarks",
      name: t("Emerald+ karşılaştırması"),
      node: (
        <section className="overlay__card">
          <p className="overlay__caption">{t("Emerald+ {role} medyanına göre", { role: positionLabel(position!, lang)?.toLocaleLowerCase(lang) ?? "" })}</p>
          {numbers.csPerMinute !== null && (
            <Benchmark label="CS/dk" value={numbers.csPerMinute.toFixed(1)} target={median(extra.benchmarks, "cs_pm")} raw={numbers.csPerMinute} />
          )}
          {numbers.killParticipation !== null && (
            <Benchmark
              label={t("Skora katkı")}
              value={formatPercent(numbers.killParticipation, lang)}
              target={median(extra.benchmarks, "kill_participation")}
              raw={numbers.killParticipation}
              percent
            />
          )}
          <p className="overlay__row">
            <span>KDA</span>
            <span className="overlay__value">{numbers.kda.toFixed(1)}</span>
          </p>
        </section>
      ),
    });
  if (paceTarget !== null)
    boxes.push({
      id: "pace",
      name: t("Tempo"),
      node: (
        <section className="overlay__card">
          <p className="overlay__caption">{t("Tempo, {time} itibarıyla", { time: clock(time) })}</p>
          <p className="overlay__row" data-ahead={me.scores.creepScore >= paceTarget}>
            <span>{t("Minyon ve kamp")}</span>
            <span className="overlay__value">
              {me.scores.creepScore}
              <span className="overlay__target"> / {Math.round(paceTarget)}</span>
            </span>
          </p>
        </section>
      ),
    });
  if (itemGold)
    boxes.push({
      id: "items",
      name: t("Eşya altını farkı"),
      node: (
        <section className="overlay__card">
          <p className="overlay__caption">{t("Eşya altını farkı")}</p>
          {itemGold.lane !== null && (
            <p className="overlay__row" data-ahead={itemGold.lane >= 0}>
              <span>{t("Koridor rakibine göre")}</span>
              <span className="overlay__value">{thousands(itemGold.lane)}</span>
            </p>
          )}
          <p className="overlay__row" data-ahead={itemGold.team >= 0}>
            <span>{t("Takım")}</span>
            <span className="overlay__value">{thousands(itemGold.team)}</span>
          </p>
        </section>
      ),
    });

  const move = (id: WidgetId, spot: Spot, done: boolean) => (done ? save : preview)({ ...layout, [id]: spot });
  const rowGap = layout.rowGap ?? ROW_GAP;

  return (
    <div className="overlay-root" data-editing={editing || undefined} aria-hidden={!editing}>
      {/* Dragged boxes stay in this list too, fixed in place, so a drag never remounts the box it moves. */}
      <div className="overlay">
        {boxes.map((b) => (
          <Draggable key={b.id} id={b.id} name={b.name} editing={editing} spot={layout[b.id] ?? null} onMove={move}>
            {b.node}
          </Draggable>
        ))}
      </div>

      {rows.length > 0 && (
        <Draggable
          id="scoreboard"
          name={t("Skor tablosu farkı")}
          editing={editing}
          spot={layout.scoreboard ?? SCOREBOARD_SPOT}
          onMove={move}
          onWheel={(event) => save({ ...layout, rowGap: Math.min(0.12, Math.max(0.02, rowGap + (event.deltaY < 0 ? 0.001 : -0.001))) })}
        >
          <ol className="overlay__scoreboard" style={{ gap: `calc(${rowGap * 100}vh - 22px)` }}>
            {rows.map((row) => (
              <li key={row.ally.riotId} data-ahead={row.diff === null ? undefined : row.diff >= 0}>
                {row.diff === null ? "–" : thousands(row.diff)}
              </li>
            ))}
          </ol>
        </Draggable>
      )}

      {editing && <EditBar onReset={reset} />}
    </div>
  );
}

function firstTrackable(habits: Habit[], game: LiveGame): (Habit & { metric: GoalMetric; target: number }) | null {
  for (const habit of habits) {
    if (!GOAL_METRICS.includes(habit.metric as GoalMetric) || habit.target === undefined) continue;
    if (goalProgress(habit.metric as GoalMetric, habit.target, game)) return habit as Habit & { metric: GoalMetric; target: number };
  }
  return null;
}

function GoalCard({ habit, game }: { habit: Habit & { metric: GoalMetric; target: number }; game: LiveGame }) {
  const t = useT();
  const lang = useLang();
  const progress = goalProgress(habit.metric, habit.target, game);
  if (!progress) return null;
  const percent = habit.metric === "kill_participation";
  const show = (n: number) => (percent ? formatPercent(n, lang) : Number.isInteger(n) ? String(n) : n.toFixed(1));
  return (
    <section className="overlay__card overlay__goal">
      <p className="overlay__caption">{t("Koçun hedefi")}</p>
      <p className="overlay__row" data-ahead={progress.onTrack ?? undefined}>
        <span>{t(GOAL_LABELS[habit.metric], { target: show(habit.target) })}</span>
        <span className="overlay__value">{show(progress.value)}</span>
      </p>
      <p className="overlay__goal-why">{t(habit.title)}</p>
    </section>
  );
}

/**
 * A box the player can drag while editing. Positions are kept as fractions
 * of the screen; a box that was never dragged sits in the default column.
 */
function Draggable({
  id,
  name,
  editing,
  spot,
  onMove,
  onWheel,
  children,
}: {
  id: WidgetId;
  name: string;
  editing: boolean;
  spot: Spot | null;
  onMove: (id: WidgetId, spot: Spot, done: boolean) => void;
  onWheel?: (event: WheelEvent) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  const at = (event: ReactPointerEvent): Spot => {
    const box = ref.current!.getBoundingClientRect();
    const x = Math.min(window.innerWidth - box.width, Math.max(0, event.clientX - grab.current!.dx));
    const y = Math.min(window.innerHeight - box.height, Math.max(0, event.clientY - grab.current!.dy));
    return { x: x / window.innerWidth, y: y / window.innerHeight };
  };

  return (
    <div
      ref={ref}
      className="overlay__box"
      data-placed={spot ? true : undefined}
      data-name={editing ? name : undefined}
      style={spot ? { left: `${spot.x * 100}vw`, top: `${spot.y * 100}vh` } : undefined}
      onPointerDown={(event) => {
        if (!editing) return;
        const box = ref.current!.getBoundingClientRect();
        grab.current = { dx: event.clientX - box.left, dy: event.clientY - box.top };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => grab.current && onMove(id, at(event), false)}
      onPointerUp={(event) => {
        if (!grab.current) return;
        onMove(id, at(event), true);
        grab.current = null;
      }}
      onWheel={editing ? onWheel : undefined}
    >
      {children}
    </div>
  );
}

function EditBar({ onReset }: { onReset: () => void }) {
  const t = useT();
  return (
    <div className="overlay__editbar" role="toolbar" aria-label={t("Overlay düzenleme")}>
      <span>{t("Kutuları sürükleyip yerleştir. Skor tablosu sütununda tekerlek satır aralığını değiştirir.")}</span>
      <button type="button" className="overlay__editbutton" onClick={onReset}>
        {t("Varsayılana dön")}
      </button>
      <button type="button" className="overlay__editbutton" data-primary onClick={() => isTauri() && invoke("set_overlay_editing", { editing: false })}>
        {t("Bitti")}
      </button>
    </div>
  );
}

function Benchmark({ label, value, target, raw, percent }: { label: string; value: string; target: number | null; raw: number; percent?: boolean }) {
  const lang = useLang();
  return (
    <p className="overlay__row" data-ahead={target === null ? undefined : raw >= target}>
      <span>{label}</span>
      <span className="overlay__value">
        {value}
        {target !== null && <span className="overlay__target"> / {percent ? formatPercent(target, lang) : target.toFixed(1)}</span>}
      </span>
    </p>
  );
}

const TIMER_NAMES = { dragon: "Ejder", baron: "Baron" } as const;
const LANE_NAMES = { top: "üst", mid: "orta", bot: "alt" } as const;

function timerLabel(timer: Timer, t: (text: string, params?: Params) => string) {
  if (timer.kind !== "inhibitor") return t(TIMER_NAMES[timer.kind]);
  return t(timer.ours ? "Bizim {lane} inhibitör" : "Rakip {lane} inhibitör", { lane: t(LANE_NAMES[timer.lane ?? "mid"]) });
}
