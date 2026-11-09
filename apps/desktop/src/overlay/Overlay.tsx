import { createElement, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getAugments, getBench, getBuild, type Build, type Picks } from "../api";
import { augmentInfo } from "../augments/data";
import { augmentQueue, augmentsByRarity } from "../augments/tiers";
import { readChosenStyle } from "../buildStyles";
import { champions, items, latestVersion, type Item } from "../data/ddragon";
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
import { benchRead, expectedAt, pushHistory, BENCH_END_MINUTE } from "./bench";
import { GRID, ROW_GAP, snapSpot, useLayout, type ScreenSize } from "./layout";
import { modeOf, widgetsFor, type Spot, type WidgetId } from "./registry";
import { hasContent } from "./widgets/active";
import type { WidgetContext } from "./widgets/context";
import { WIDGET_VIEWS } from "./widgets";
import { sampleGame } from "./sample";
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
  const benchNow = expected && me ? benchRead({ cs: me.scores.creepScore, level: me.level }, expected) : null;
  const [csHistory, setCsHistory] = useState<{ at: number; diff: number }[]>([]);
  const csDiff = benchNow?.csDiff;
  useEffect(() => {
    if (csDiff !== undefined) setCsHistory((h) => pushHistory(h, time, csDiff));
  }, [time, csDiff]);

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

  const names = augmentNames.status === "done" ? augmentNames.value : null;
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
    objectives: timers,
    itemGold,
    nextItem: next,
    bench: benchNow ? { read: benchNow, history: csHistory.map((p) => p.diff) } : null,
    rows,
    rowGap: layout.rowGap ?? ROW_GAP,
    augments:
      augments.status === "done" && augments.value && names
        ? augmentsByRarity(augments.value.augments, (id) => names.get(id)?.rarity, AUGMENTS_PER_RARITY)
        : [],
    augmentNames: names,
  };

  const move = (id: WidgetId, spot: Spot, done: boolean) => (done ? save : preview)({ ...layout, [id]: spot });

  // Widgets that have nothing to show take no box.
  const boxes = widgetsFor(mode).filter((def) => def.settings.some((key) => settings[key]) && hasContent[def.id](ctx, settings));

  return (
    <div className="overlay-root" data-editing={editing || undefined} aria-hidden={!editing} style={{ "--overlay-scale": settings.overlayScale } as CSSProperties}>
      {/* Dragged boxes stay in this list too, fixed in place, so a drag never remounts the box it moves. */}
      <div className="overlay">
        {boxes
          .filter((def) => !def.defaultSpot)
          .map((def) => (
            <Draggable key={def.id} id={def.id} name={t(def.name)} editing={editing} spot={layout[def.id] ?? null} onMove={move}>
              {createElement(WIDGET_VIEWS[def.id], ctx)}
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
            onWheel={def.id === "scoreboard" ? (event) => save({ ...layout, rowGap: Math.min(0.12, Math.max(0.02, ctx.rowGap + (event.deltaY < 0 ? 0.001 : -0.001))) }) : undefined}
          >
            {createElement(WIDGET_VIEWS[def.id], ctx)}
          </Draggable>
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
    return snapSpot({ x: x / window.innerWidth, y: y / window.innerHeight }, { width: window.innerWidth, height: window.innerHeight }, GRID);
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
