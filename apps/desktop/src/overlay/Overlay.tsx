import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getBenchmarks, getBuild, getPace, type Benchmarks, type Build, type Pace } from "../api";
import { champions, items } from "../data/ddragon";
import { overlayFixture, scoutingFixture } from "../dev/fixtures";
import { platformOf, type LcuStatus, type Platform } from "../lcu";
import { formatPercent, setClientLocale, useLang, useT, type Params } from "../i18n";
import { positionLabel } from "../labels";
import { useSettings } from "../settings";
import { useAsync } from "../useAsync";
import { championKey, clock, type Timer, findMe, itemDifference, myNumbers, nextSkill, objectiveTimers, paceAt, type LiveGame } from "./live";
import { Scouting } from "./Scouting";
import "./overlay.css";

function useLiveGame(): LiveGame | null {
  const [game, setGame] = useState<LiveGame | null>(() => overlayFixture());
  useEffect(() => {
    if (!isTauri()) return;
    invoke<LiveGame | null>("live_game").then(setGame, () => {});
    const off = listen<LiveGame | null>("live-game", (event) => setGame(event.payload));
    return () => {
      off.then((stop) => stop());
    };
  }, []);
  return game;
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

function useLoading() {
  const [loading, setLoading] = useState(() => scoutingFixture() !== null);
  useEffect(() => {
    if (!isTauri()) return;
    invoke<boolean>("live_loading").then(setLoading, () => {});
    const off = listen<boolean>("live-loading", (event) => setLoading(event.payload));
    return () => {
      off.then((stop) => stop());
    };
  }, []);
  return loading;
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

function useHidden() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!isTauri()) return;
    invoke<boolean>("overlay_hidden").then(setHidden, () => {});
    const off = listen<boolean>("overlay-toggle", (event) => setHidden(event.payload));
    return () => {
      off.then((stop) => stop());
    };
  }, []);
  return hidden;
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
  championIds: Map<string, number>;
  gold: Map<number, number>;
};

async function loadStatic(): Promise<Static> {
  const [byKey, itemList] = await Promise.all([champions(), items()]);
  return {
    championIds: new Map([...byKey.values()].map((c) => [c.id, c.key])),
    gold: new Map([...itemList.values()].map((i) => [i.id, i.gold])),
  };
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

export function Overlay() {
  useClientLocale();
  const t = useT();
  const lang = useLang();
  const game = useLiveGame();
  const loading = useLoading();
  const player = usePlayer(loading);
  const hidden = useHidden();
  const settings = useSettings();
  const time = useGameClock(game);
  const [data] = useAsync(game ? "static" : null, loadStatic);
  const me = game ? findMe(game) : undefined;
  const championId = me && data.status === "done" ? (data.value.championIds.get(championKey(me)) ?? null) : null;
  // Positions are empty outside Summoner's Rift; builds and benchmarks are per role.
  const position = me?.position || null;
  const [helpers] = useAsync(championId && position ? `${championId}:${position}` : null, () => loadHelpers(championId!, position!));

  if (hidden || !settings.overlay) return null;
  if (loading) {
    return settings.overlayScouting ? (
      <div className="overlay" aria-hidden="true">
        <Scouting player={player} fixture={scoutingFixture()} />
      </div>
    ) : null;
  }
  if (!game || !me) return null;
  const extra = helpers.status === "done" ? helpers.value : { build: null, benchmarks: null, pace: null };
  const skill = settings.overlaySkills ? nextSkill(game.level, game.skills, extra.build?.skills ?? null) : null;
  const timers = settings.overlayObjectives ? objectiveTimers(game, me.team) : [];
  const numbers = settings.overlayBenchmarks && position ? myNumbers(game) : null;
  const gold = data.status === "done" ? data.value.gold : null;
  const paceTarget = settings.overlayPace && extra.pace ? paceAt(extra.pace.median, time / 60) : null;
  const items = settings.overlayItems && gold ? itemDifference(game, (id) => gold.get(id) ?? 0) : null;

  return (
    <div className="overlay" aria-hidden="true">
      {skill && (
        <section className="overlay__card overlay__skill">
          <span className="overlay__key">{skill}</span>
          <span>{t("yükselt")}</span>
        </section>
      )}

      {timers.length > 0 && (
        <section className="overlay__card">
          {timers.map((timer) => (
            <p key={timer.id} className="overlay__row" data-ours={timer.ours ?? undefined}>
              <span>{timerLabel(timer, t)}</span>
              <span className="overlay__value">{clock(timer.at - time)}</span>
            </p>
          ))}
        </section>
      )}

      {numbers && (numbers.csPerMinute !== null || numbers.killParticipation !== null) && (
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
      )}

      {paceTarget !== null && (
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
      )}

      {items && (
        <section className="overlay__card">
          <p className="overlay__caption">{t("Eşya altını farkı")}</p>
          {items.lane !== null && (
            <p className="overlay__row" data-ahead={items.lane >= 0}>
              <span>{t("Koridor rakibine göre")}</span>
              <span className="overlay__value">{thousands(items.lane)}</span>
            </p>
          )}
          <p className="overlay__row" data-ahead={items.team >= 0}>
            <span>{t("Takım")}</span>
            <span className="overlay__value">{thousands(items.team)}</span>
          </p>
        </section>
      )}
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
