import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useT } from "../i18n";
import { useSettings } from "../settings";
import { clock, type LiveGame, type Timer } from "./live";

// Timers the player starts with a shortcut. The game itself shows camp
// respawns on the minimap once a camp is seen cleared; these only count the
// time the player entered, nothing is read from the game.

type Preset = { label: string; seconds: number };

// Respawn and spawn times in seconds. Riot changes these now and then; patch them here.
export const PRESETS: Record<string, Preset> = {
  blue: { label: "Mavi", seconds: 300 },
  red: { label: "Kırmızı", seconds: 300 },
  gromp: { label: "Gromp", seconds: 135 },
  wolves: { label: "Kurtlar", seconds: 135 },
  raptors: { label: "Kuşlar", seconds: 135 },
  krugs: { label: "Golemler", seconds: 135 },
  scuttle: { label: "Yengeç", seconds: 150 },
  dragon: { label: "Ejder", seconds: 300 },
  baron: { label: "Baron", seconds: 360 },
};

const FIRST_SPAWNS = [
  { id: "first-dragon", label: "Ejder doğuyor", at: 300, event: "DragonKill" },
  { id: "first-herald", label: "Herald doğuyor", at: 900, event: "HeraldKill" },
  { id: "first-baron", label: "Baron doğuyor", at: 1200, event: "BaronKill" },
];

/** Seconds left at which a timer counts as coming up. */
const SOON = 30;

type Manual = { id: string; label: string; at: number };

export type TimerRow = { id: string; label: string; at: number; ours?: boolean | null };

function beep(context: AudioContext, high: boolean) {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.frequency.value = high ? 880 : 660;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
  osc.connect(gain).connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + 0.4);
}

/** Manual timers, the stopwatch and first spawns, fed by the shortcut events. */
export function useManualTimers(game: LiveGame | null, time: number) {
  const settings = useSettings();
  const [manual, setManual] = useState<Manual[]>([]);
  const [watch, setWatch] = useState<{ from: number | null; total: number }>({ from: null, total: 0 });
  const timeRef = useRef(time);
  timeRef.current = time;
  const customRef = useRef(settings.customTimerSeconds);
  customRef.current = settings.customTimerSeconds;

  useEffect(() => {
    if (!isTauri()) return;
    const off = listen<string>("overlay-timer", ({ payload }) => {
      const now = timeRef.current;
      if (payload === "clear") {
        setManual([]);
        setWatch({ from: null, total: 0 });
      } else if (payload === "stopwatch") {
        setWatch((w) => (w.from === null ? { ...w, from: now } : { from: null, total: w.total + now - w.from }));
      } else if (payload === "custom") {
        const id = `custom-${Math.round(now)}`;
        setManual((list) => [...list, { id, label: "Zamanlayıcı", at: now + customRef.current }]);
      } else if (PRESETS[payload]) {
        // Pressing a camp again restarts it, e.g. after a misclick.
        setManual((list) => [...list.filter((m) => m.id !== payload), { id: payload, label: PRESETS[payload].label, at: now + PRESETS[payload].seconds }]);
      }
    });
    return () => {
      off.then((stop) => stop());
    };
  }, []);

  const firsts: TimerRow[] = game
    ? FIRST_SPAWNS.filter((f) => time < f.at && !game.events.some((e) => e.name === f.event)).map((f) => ({ id: f.id, label: f.label, at: f.at }))
    : [];
  const active = manual.filter((m) => m.at > time - 5);
  const stopwatch = watch.from === null && watch.total === 0 ? null : watch.total + (watch.from === null ? 0 : time - watch.from);
  return { manual: active, firsts, stopwatch, running: watch.from !== null };
}

/** Plays a tone and flags rows as a timer reaches 30 seconds and again at zero. */
export function useAlerts(rows: TimerRow[], time: number) {
  const settings = useSettings();
  const heard = useRef(new Set<string>());
  const audio = useRef<AudioContext | null>(null);
  useEffect(() => {
    for (const row of rows) {
      const left = row.at - time;
      for (const [mark, high] of [
        [SOON, false],
        [0, true],
      ] as const) {
        const key = `${row.id}@${row.at}:${mark}`;
        if (left <= mark && left > mark - 2 && !heard.current.has(key)) {
          heard.current.add(key);
          if (settings.timerSound) {
            try {
              audio.current ??= new AudioContext();
              void audio.current.resume();
              beep(audio.current, high);
            } catch {
              // No audio device; the row still flags.
            }
          }
        }
      }
    }
  }, [rows, time, settings.timerSound]);
  return (row: TimerRow) => {
    const left = row.at - time;
    return left <= 0 ? "now" : left <= SOON ? "soon" : undefined;
  };
}

export function TimerCard({
  objectives,
  objectiveLabel,
  game,
  time,
}: {
  objectives: Timer[];
  objectiveLabel: (timer: Timer) => string;
  game: LiveGame | null;
  time: number;
}) {
  const t = useT();
  const settings = useSettings();
  const { manual, firsts, stopwatch, running } = useManualTimers(game, time);
  const rows: TimerRow[] = [
    ...objectives.map((o) => ({ id: o.id, label: objectiveLabel(o), at: o.at, ours: o.ours })),
    ...(settings.overlayTimers ? [...firsts.map((f) => ({ ...f, label: t(f.label) })), ...manual.map((m) => ({ ...m, label: t(m.label) }))] : []),
  ].sort((a, b) => a.at - b.at);
  const state = useAlerts(rows, time);
  if (rows.length === 0 && stopwatch === null) return null;
  return (
    <section className="overlay__card">
      {rows.map((row) => (
        <p key={`${row.id}@${row.at}`} className="overlay__row" data-ours={row.ours ?? undefined} data-alert={state(row)}>
          <span>{row.label}</span>
          <span className="overlay__value">{row.at - time <= 0 ? t("Şimdi") : clock(row.at - time)}</span>
        </p>
      ))}
      {stopwatch !== null && settings.overlayTimers && (
        <p className="overlay__row" data-running={running || undefined}>
          <span>{t("Kronometre")}</span>
          <span className="overlay__value">{clock(stopwatch)}</span>
        </p>
      )}
    </section>
  );
}
