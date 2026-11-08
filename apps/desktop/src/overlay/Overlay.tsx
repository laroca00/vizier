import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getAugments, getBuild, type Build, type Picks } from "../api";
import { augmentInfo, RARITY } from "../augments/data";
import { augmentQueue, augmentsByRarity } from "../augments/tiers";
import { readChosenStyle } from "../buildStyles";
import { champions, itemIconUrl, items, latestVersion, type Item } from "../data/ddragon";
import { overlayFixture } from "../dev/fixtures";
import type { LcuStatus } from "../lcu";
import { setClientLocale, useLang, useT, type Params } from "../i18n";
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
  type Timer,
} from "./live";
import { ROW_GAP, SCOREBOARD_SPOT, useLayout, type Spot, type WidgetId } from "./layout";
import { sampleGame } from "./sample";
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
const thousands = (gold: number) => `${gold > 0 ? "+" : gold < 0 ? "−" : ""}${(Math.abs(gold) / 1000).toFixed(1)}k`;

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
  const { layout, preview, save, reset } = useLayout();
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

  // The loading screen gets nothing; the overlay starts with the game.
  if (hidden || !settings.overlay || (loading && !editing)) return null;
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
  // The card hides itself when it has nothing to count; manual timers live inside it.
  if (timers.length > 0 || settings.overlayTimers)
    boxes.push({
      id: "timers",
      name: t("Süreler"),
      node: <TimerCard objectives={timers} objectiveLabel={(timer) => timerLabel(timer, t)} game={game} time={time} />,
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

  if (augments.status === "done" && augments.value && augmentNames.status === "done") {
    const names = augmentNames.value;
    const groups = augmentsByRarity(augments.value.augments, (id) => names.get(id)?.rarity, AUGMENTS_PER_RARITY);
    if (groups.length > 0)
      boxes.push({
        id: "augments",
        name: t("Augment önerisi"),
        node: (
          <section className="overlay__card overlay__augments">
            <p className="overlay__caption">{t("En iyi augment'ler")}</p>
            {groups.map((group) => (
              <div key={group.rarity} className="overlay__augment-group" data-rarity={group.rarity}>
                <span className="overlay__augment-rarity">{t(RARITY[group.rarity] ?? "")}</span>
                <ol>
                  {group.augments.map((a) => (
                    <li key={a.augmentId}>
                      <span className="overlay__augment-tier" data-tier={a.tier}>
                        {a.tier}
                      </span>
                      {names.get(a.augmentId)?.name}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </section>
        ),
      });
  }

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

const TIMER_NAMES = { dragon: "Ejder", baron: "Baron" } as const;
const LANE_NAMES = { top: "üst", mid: "orta", bot: "alt" } as const;

function timerLabel(timer: Timer, t: (text: string, params?: Params) => string) {
  if (timer.kind !== "inhibitor") return t(TIMER_NAMES[timer.kind]);
  return t(timer.ours ? "Bizim {lane} inhibitör" : "Rakip {lane} inhibitör", { lane: t(LANE_NAMES[timer.lane ?? "mid"]) });
}
