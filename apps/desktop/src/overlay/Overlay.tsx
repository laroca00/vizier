import { createElement, type CSSProperties, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getAugments, getBench, getBuild, getCounters, type Build, type Picks } from "../api";
import { augmentInfo } from "../augments/data";
import { augmentQueue, augmentsByRarity } from "../augments/tiers";
import { readChosenStyle } from "../buildStyles";
import { championDetail, champions, items, latestVersion, runes as runeStyles, type Champion, type Item } from "../data/ddragon";
import { threatOf } from "../draft/threats";
import { matchupRecord, planShown, PLAN_UNTIL, type Plan } from "./plan";
import { overlayFixture, scoutingFixture } from "../dev/fixtures";
import { ScoutPanel } from "./ScoutPanel";
import type { LcuStatus } from "../lcu";
import { setClientLocale, useLang, useT } from "../i18n";
import { useSettings } from "../settings";
import { useAsync } from "../useAsync";
import {
  championKey,
  findMe,
  itemDifference,
  nextItem,
  nextSkill,
  objectiveTimers,
  scoreboardRows,
  type LiveGame,
} from "./live";
import { skillSequence } from "../SkillGrid";
import { benchRead, expectedAt, pushHistory, BENCH_END_MINUTE } from "./bench";
import { rootVars, widgetVars } from "./appearance";
import { GRID, ROW_GAP, snapSpot, useLayout, type ScreenSize } from "./layout";
import { modeOf, widgetsFor, type Spot, type WidgetId } from "./registry";
import { emptyText, hasContent } from "./widgets/active";
import type { WidgetContext } from "./widgets/context";
import { WIDGET_VIEWS } from "./widgets";
import { WidgetBoundary, EmptyCard } from "./widgets/WidgetBoundary";
import { sampleGame } from "./sample";
import { minimapBox } from "./minimap";
import { panelItems, panelRunes } from "./buildPanel";
import { combosOf } from "../data/combos";
import { usePersonal } from "../personal";
import { laneOpponent, panelCombos, referenceNote } from "./reference";
import { CLOCK_TICK_MS } from "./tick";
import { useManualTimers } from "./Timers";
import { fallenPlayers, readWindow } from "./opportunity";
import { readDragons } from "./dragons";
import { FLASH_SLOTS, flashTimers, type FlashSlot } from "./flash";
import { itemAdvice } from "../draft/itemAdvice";
import { buildPool } from "../draft/ItemAdvicePanel";
import { openAnswers } from "./itemAnswers";
import { newSpikes, sampleSpikes, shownSpikes, type Spike } from "./spikes";
import type { LiveGame as Game } from "./live";
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

/**
 * The game clock only arrives once a second; this counts down between
 * updates so timers don't tick in visible jumps.
 */
function useGameClock(game: LiveGame | null) {
  const [now, setNow] = useState(() => performance.now());
  const [anchor, setAnchor] = useState({ gameTime: 0, at: performance.now() });
  const gameTime = game?.gameTime;
  useEffect(() => {
    if (gameTime !== undefined) setAnchor({ gameTime, at: performance.now() });
  }, [gameTime]);
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return anchor.gameTime + Math.min(1.5, (now - anchor.at) / 1000);
}

type Static = {
  version: string;
  championIds: Map<string, number>;
  /** Data Dragon id to the name players read. */
  championNames: Map<string, string>;
  /** Data Dragon id to the champion, for the trait rules. */
  championsById: Map<string, Champion>;
  items: Map<number, Item>;
};

async function loadStatic(): Promise<Static> {
  const [version, byKey, itemList] = await Promise.all([latestVersion(), champions(), items()]);
  return {
    version,
    championIds: new Map([...byKey.values()].map((c) => [c.id, c.key])),
    championNames: new Map([...byKey.values()].map((c) => [c.id, c.name])),
    championsById: new Map([...byKey.values()].map((c) => [c.id, c])),
    items: itemList,
  };
}

// A rare pick can have no build; the panels that need it just stay hidden.
const loadBuild = (championId: number, position: string) => getBuild(championId, position).catch(() => null);
const AUGMENTS_PER_RARITY = 4;

/** The build the player picked on the build page, else the most played style. */
function picksFor(build: Build | null, championId: number, position: string): Picks | null {
  if (!build) return null;
  const chosen = readChosenStyle(championId, position);
  const variants = build.variants ?? [];
  return variants.find((v) => v.style === chosen) ?? (variants.length >= 2 ? variants[0] : build);
}

export function Overlay() {
  // Counted per commit (not per render call, which StrictMode doubles); read by scripts/overlay-perf.mjs.
  useEffect(() => {
    if (import.meta.env.DEV) {
      const w = window as unknown as { __overlayRenders?: number };
      w.__overlayRenders = (w.__overlayRenders ?? 0) + 1;
    }
  });
  useClientLocale();
  const t = useT();
  const liveGame = useBackendFlag<LiveGame | null>("live_game", "live-game", overlayFixture());
  const loading = useBackendFlag("live_loading", "live-loading", false);
  const hidden = useBackendFlag("overlay_hidden", "overlay-toggle", false);
  const editing = useBackendFlag("overlay_editing", "overlay-edit", new URLSearchParams(location.search).has("edit"));
  const tabHeld = useBackendFlag(null, "overlay-scoreboard", false);
  const size = useScreenSize();
  const mode = modeOf(liveGame?.gameMode ?? "CLASSIC");
  const { layout, preview, save, reset } = useLayout(mode, size);
  // Arranging the boxes before a game uses a made-up one.
  const game = liveGame ?? (editing ? sampleGame() : null);
  const settings = useSettings();
  const time = useGameClock(game);
  const manualTimers = useManualTimers(game, time);
  const [data] = useAsync(game ? "static" : null, loadStatic);
  const me = game ? findMe(game) : undefined;
  const championId = me && data.status === "done" ? (data.value.championIds.get(championKey(me)) ?? null) : null;
  // Positions are empty outside Summoner's Rift; builds are per role.
  const position = me?.position || null;
  const [build] = useAsync(championId && position ? `${championId}:${position}` : null, () => loadBuild(championId!, position!));
  const lang = useLang();
  const queue = game ? augmentQueue(game.gameMode) : null;
  const wantAugments = settings.overlayAugments && queue !== null && championId !== null;
  const [augments] = useAsync(wantAugments ? `augments:${queue}:${championId}` : null, () => getAugments(queue!, championId!).catch(() => null));
  const [augmentNames] = useAsync(wantAugments ? `augment-info:${lang}` : null, () => augmentInfo(lang));

  const wantBench = settings.overlayBench && mode === "rift" && championId !== null && position !== null && time / 60 <= BENCH_END_MINUTE;
  const [benchDoc] = useAsync(wantBench ? `bench:${championId}:${position}` : null, () => getBench(championId!, position!).catch(() => null));
  const expected = wantBench && benchDoc.status === "done" && benchDoc.value ? expectedAt(benchDoc.value.minutes, time / 60) : null;
  const benchNow = expected && me ? benchRead(
        {
          cs: me.scores.creepScore,
          level: me.level,
          kills: me.scores.kills,
          assists: me.scores.assists,
          teamKills: game!.players.filter((p) => p.team === me.team).reduce((sum, p) => sum + p.scores.kills, 0),
        },
        expected,
      ) : null;
  const [csHistory, setCsHistory] = useState<{ at: number; diff: number }[]>([]);
  const csDiff = benchNow?.csDiff;
  useEffect(() => {
    if (csDiff !== undefined) setCsHistory((h) => pushHistory(h, time, csDiff));
  }, [time, csDiff]);

  // The augment card shows by default; the player can hide it for rounds where it only gets in the way.
  const [augmentsShown, setAugmentsShown] = useState(true);
  useEffect(() => {
    if (!isTauri()) return;
    const off = listen<string>("overlay-timer", ({ payload }) => payload === "augments" && setAugmentsShown((shown) => !shown));
    return () => void off.then((stop) => stop());
  }, []);

  // The quick reference panel opens and closes on its hotkey.
  const [refOpen, setRefOpen] = useState(false);
  useEffect(() => {
    if (!isTauri()) return;
    const off = listen<string>("overlay-timer", ({ payload }) => payload === "reference" && setRefOpen((open) => !open));
    return () => void off.then((stop) => stop());
  }, []);
  const { notes } = usePersonal();

  // The build panel opens and closes on its hotkey.
  const [buildOpen, setBuildOpen] = useState(false);
  useEffect(() => {
    if (!isTauri()) return;
    const off = listen<string>("overlay-timer", ({ payload }) => payload === "build" && setBuildOpen((open) => !open));
    return () => void off.then((stop) => stop());
  }, []);
  const wantRunes = (settings.overlayBuild && buildOpen) || (settings.overlayReference && refOpen && settings.overlayRefSections.includes("runes")) || editing;
  const [runeData] = useAsync(wantRunes ? "runes" : null, runeStyles);

  // The skill order opens and closes on its hotkey, which arrives like a timer key.
  const [orderOpen, setOrderOpen] = useState(false);
  useEffect(() => {
    if (!isTauri()) return;
    const off = listen<string>("overlay-timer", ({ payload }) => payload === "skills" && setOrderOpen((open) => !open));
    return () => void off.then((stop) => stop());
  }, []);

  // The game-start card: our record against the lane opponent and the ability to respect.
  const laneFoe = game && me ? laneOpponent(game, me) : null;
  const foeKey = laneFoe ? championKey(laneFoe) : null;
  const wantPlan = settings.overlayPlan && mode === "rift" && championId !== null && position !== null && foeKey !== null && (time < PLAN_UNTIL || editing);
  const [planData] = useAsync(wantPlan ? `plan:${lang}:${championId}:${position}:${foeKey}` : null, async () => {
    const [counters, byKey, detail] = await Promise.all([
      getCounters(championId!, position!).catch(() => null),
      champions(),
      championDetail(foeKey!, lang).catch(() => null),
    ]);
    const foe = [...byKey.values()].find((c) => c.id === foeKey) ?? null;
    return { counters, foe, threat: foe && detail ? threatOf(foe, detail.abilities) : null };
  });

  // Enemy Flashes the player marked with a hotkey, by slot, at the game time of the press.
  const [flashPresses, setFlashPresses] = useState<Partial<Record<FlashSlot, number>>>({});
  const clockRef = useRef(time);
  clockRef.current = time;
  useEffect(() => {
    if (!isTauri()) return;
    const off = listen<string>("overlay-timer", ({ payload }) => {
      if (payload === "clear") setFlashPresses({});
      else if ((FLASH_SLOTS as readonly string[]).includes(payload)) setFlashPresses((p) => ({ ...p, [payload]: clockRef.current }));
    });
    return () => void off.then((stop) => stop());
  }, []);

  // Enemy power spikes come from comparing each update with the one before.
  const [spikeLog, setSpikeLog] = useState<Spike[]>([]);
  const lastGame = useRef<Game | null>(null);
  const itemTable = data.status === "done" ? data.value.items : null;
  useEffect(() => {
    if (!liveGame || !settings.overlaySpikes || !itemTable) {
      lastGame.current = liveGame;
      return;
    }
    const self = findMe(liveGame);
    if (self) {
      const fresh = newSpikes(lastGame.current, liveGame, self, laneOpponent(liveGame, self), (id) => {
        const item = itemTable.get(id);
        return !!item?.complete && !item.boots;
      });
      if (fresh.length > 0) setSpikeLog((log) => [...log.filter((s) => liveGame.gameTime - s.at < 60), ...fresh]);
    }
    lastGame.current = liveGame;
  }, [liveGame, settings.overlaySpikes, itemTable]);

  // The loading screen gets nothing; the overlay starts with the game.
  if (hidden || !settings.overlay) return null;
  // The loading screen gets the scouting panel; the boxes start with the game.
  if ((loading || scoutingFixture()) && !editing) return settings.overlayScouting ? <ScoutPanel /> : null;
  if (!game || !me) return null;
  const extra = { build: build.status === "done" ? build.value : null };
  const itemInfo = data.status === "done" ? data.value.items : null;
  const gold = (id: number) => itemInfo?.get(id)?.gold ?? 0;
  const picks = championId && position ? picksFor(extra.build, championId, position) : null;

  const skill = settings.overlaySkills ? nextSkill(game.level, game.skills, picks?.skills ?? null) : null;
  const timers = settings.overlayObjectives ? objectiveTimers(game, me.team) : [];
  const itemGold = settings.overlayItems && itemInfo ? itemDifference(game, gold) : null;

  const buildItems = picks ? [...new Set([...(picks.coreItems?.ids ?? []), ...picks.items.map((i) => i.id)])].filter((id) => itemInfo?.get(id)?.complete) : [];
  const next = settings.overlayNextItem && itemInfo ? nextItem(me.items.map((i) => i.itemId), buildItems) : null;
  const rows = settings.overlayScoreboard && itemInfo && (tabHeld || editing) ? scoreboardRows(game, gold) : [];

  const opponent = laneOpponent(game, me);
  const opponentId = opponent && data.status === "done" ? (data.value.championIds.get(championKey(opponent)) ?? null) : null;
  const referenceFor = (): WidgetContext["reference"] => ({
    shown: refOpen || editing,
    sections: settings.overlayRefSections,
    combos: settings.overlayRefSections.includes("combo") ? panelCombos(combosOf(championKey(me))) : [],
    note: championId ? referenceNote(notes, championId, opponentId) : null,
    opponent: opponent ? championKey(opponent) : null,
    lang,
  });

  const names = augmentNames.status === "done" ? augmentNames.value : null;
  const fallen = settings.overlayWindow ? fallenPlayers(game, me.team) : [];
  const foe = planData.status === "done" ? planData.value.foe : null;
  const planNote = championId && foe ? referenceNote(notes, championId, Number(foe.key)) : null;
  const plan: Plan | null =
    planData.status === "done" && foe && foeKey
      ? {
          opponent: foe.name,
          opponentKey: foeKey,
          matchup: matchupRecord(planData.value.counters, Number(foe.key)),
          threat: planData.value.threat,
          note: planNote?.matchup ? planNote.text : null,
        }
      : null;
  const championNames = data.status === "done" ? data.value.championNames : null;
  const byId = data.status === "done" ? data.value.championsById : null;
  const enemyChampions = byId ? game.players.filter((p) => p.team !== me.team).flatMap((p) => byId.get(championKey(p)) ?? []) : [];
  const answers =
    settings.overlayItemAnswers && extra.build ? openAnswers(itemAdvice(enemyChampions, buildPool(extra.build)), me.items.map((i) => i.itemId)) : [];
  const ctx: WidgetContext = {
    t,
    game,
    me,
    time,
    version: data.status === "done" ? data.value.version : null,
    items: itemInfo,
    gold,
    picks,
    skill,
    skillOrder: { keys: picks?.skills ? skillSequence(picks.skills) : [], ranked: game.skills.reduce((sum, n) => sum + n, 0), shown: orderOpen || editing },
    objectives: timers,
    manualTimers,
    minimap: { box: minimapBox(size, settings.overlayMinimapSide, settings.overlayMinimapSize), campSide: settings.overlayCampSide },
    itemGold,
    nextItem: next,
    bench: benchNow ? { read: benchNow, history: csHistory.map((p) => p.diff) } : null,
    rows,
    buildPanel: {
      shown: buildOpen || editing,
      items: picks ? panelItems(picks.coreItems?.ids ?? [], picks.items.map((i) => i.id), me.items.map((i) => i.itemId), (id) => itemInfo?.get(id)?.complete === true) : [],
      runes: panelRunes(picks?.runes[0], runeData.status === "done" ? runeData.value : null),
    },
    reference: referenceFor(),
    rowsTotal: rows.length > 0 ? (itemDifference(game, gold)?.team ?? null) : null,
    rowGap: layout.rowGap ?? ROW_GAP,
    augments:
      augments.status === "done" && augments.value && names
        ? augmentsByRarity(augments.value.augments, (id) => names.get(id)?.rarity, AUGMENTS_PER_RARITY)
        : [],
    augmentPatches: augments.status === "done" && augments.value ? augments.value.patches : [],
    augmentsShown,
    augmentNames: names,
    championName: (key) => championNames?.get(key) ?? key,
    dragons: settings.overlayDragons && mode === "rift" ? readDragons(game, me.team) : null,
    plan: planShown(time, plan, editing) ? plan : null,
    itemAnswers: answers,
    flashes: settings.overlayFlash ? flashTimers(editing && Object.keys(flashPresses).length === 0 ? { flash3: time - 120 } : flashPresses, game, me.team, time) : [],
    opportunity: { fallen, window: readWindow(fallen, time, timers, mode === "rift") },
    spikes: settings.overlaySpikes ? shownSpikes(editing && shownSpikes(spikeLog, time).length === 0 ? sampleSpikes(time) : spikeLog, time) : [],
  };

  const move = (id: WidgetId, spot: Spot, done: boolean) => (done ? save : preview)({ ...layout, [id]: spot });

  // Widgets that have nothing to show take no box.
  const shown = widgetsFor(mode).filter((def) => def.settings.some((key) => settings[key]) && (hasContent[def.id](ctx, settings) || emptyText(def.id, ctx) !== null));
  const view = (id: WidgetId) => (hasContent[id](ctx, settings) ? createElement(WIDGET_VIEWS[id], ctx) : <EmptyCard text={t(emptyText(id, ctx) ?? "")} />);
  const boxes = shown.filter((def) => !def.fixed);
  const pinned = shown.filter((def) => def.fixed);

  return (
    <div className="overlay-root" data-editing={editing || undefined} aria-hidden={!editing} style={rootVars(settings.overlayTheme, settings.overlayScale)}>
      {/* Dragged boxes stay in this list too, fixed in place, so a drag never remounts the box it moves. */}
      <div className="overlay">
        {boxes
          .filter((def) => !def.defaultSpot)
          .map((def) => (
            <Draggable key={def.id} id={def.id} name={t(def.name)} editing={editing} spot={layout[def.id] ?? null} onMove={move} vars={widgetVars(settings.overlayWidgetStyles[def.id])}>
              <WidgetBoundary>{view(def.id)}</WidgetBoundary>
            </Draggable>
          ))}
      </div>

      {boxes
        .filter((def) => def.defaultSpot)
        .map((def) => (
          <Draggable
            key={def.id}
            id={def.id}
            name={t(def.name)}
            editing={editing}
            spot={layout[def.id] ?? def.defaultSpot!}
            onMove={move}
            vars={widgetVars(settings.overlayWidgetStyles[def.id])}
            onWheel={def.id === "scoreboard" ? (event) => save({ ...layout, rowGap: Math.min(0.12, Math.max(0.02, ctx.rowGap + (event.deltaY < 0 ? 0.001 : -0.001))) }) : undefined}
          >
            <WidgetBoundary>{view(def.id)}</WidgetBoundary>
          </Draggable>
        ))}

      {pinned.map((def) => (
        <div key={def.id} className="overlay__pins" style={widgetVars(settings.overlayWidgetStyles[def.id])}>
          <WidgetBoundary>{view(def.id)}</WidgetBoundary>
        </div>
      ))}

      {editing && <EditBar onReset={reset} />}
    </div>
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
  vars,
  children,
}: {
  id: WidgetId;
  name: string;
  editing: boolean;
  spot: Spot | null;
  onMove: (id: WidgetId, spot: Spot, done: boolean) => void;
  onWheel?: (event: WheelEvent) => void;
  vars: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const grab = useRef<{ dx: number; dy: number } | null>(null);

  const at = (event: ReactPointerEvent): Spot => {
    const box = ref.current!.getBoundingClientRect();
    const x = Math.min(window.innerWidth - box.width, Math.max(0, event.clientX - grab.current!.dx));
    const y = Math.min(window.innerHeight - box.height, Math.max(0, event.clientY - grab.current!.dy));
    return snapSpot({ x: x / window.innerWidth, y: y / window.innerHeight }, { width: window.innerWidth, height: window.innerHeight }, GRID);
  };

  return (
    <div
      ref={ref}
      className="overlay__box"
      data-placed={spot ? true : undefined}
      data-name={editing ? name : undefined}
      style={spot ? { ...vars, left: `${spot.x * 100}vw`, top: `${spot.y * 100}vh` } : vars}
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
      <div className="overlay__zoom">{children}</div>
    </div>
  );
}

function useScreenSize(): ScreenSize {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return size;
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
