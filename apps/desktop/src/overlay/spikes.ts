import { championKey, type LiveGame, type LivePlayer } from "./live";

export type Spike = { id: string; champion: string; lane: boolean; at: number } & ({ kind: "level"; level: number } | { kind: "item"; itemId: number });

const ULT_LEVELS = [6, 11, 16];
// A gap this long means the overlay missed frames (alt-tab, reconnect); what changed meanwhile is old news.
const MAX_GAP = 10;
/** How long a notice stays up, in game seconds. */
export const SPIKE_SECONDS = 12;
const MAX_SHOWN = 4;

/**
 * What enemies gained since the last frame: an ultimate rank (levels 6, 11, 16)
 * or a finished item. Boots and components don't count; `finished` says which
 * items do.
 */
export function newSpikes(prev: LiveGame | null, next: LiveGame, me: LivePlayer, opponent: LivePlayer | null, finished: (itemId: number) => boolean): Spike[] {
  if (!prev || next.gameTime < prev.gameTime || next.gameTime - prev.gameTime > MAX_GAP) return [];
  const before = new Map(prev.players.map((p) => [p.riotId, p]));
  const out: Spike[] = [];
  for (const p of next.players) {
    if (p.team === me.team) continue;
    const old = before.get(p.riotId);
    if (!old) continue;
    const champion = championKey(p);
    const lane = opponent?.riotId === p.riotId;
    const base = { champion, lane, at: next.gameTime };
    for (const level of ULT_LEVELS) {
      if (old.level < level && p.level >= level) out.push({ ...base, id: `${p.riotId}:L${level}`, kind: "level", level });
    }
    const had = new Set(old.items.map((i) => i.itemId));
    for (const { itemId } of p.items) {
      if (!had.has(itemId) && finished(itemId)) out.push({ ...base, id: `${p.riotId}:I${itemId}`, kind: "item", itemId });
    }
  }
  return out;
}

/** Notices still fresh at `time`, lane opponent first, then newest. */
export function shownSpikes(spikes: Spike[], time: number): Spike[] {
  return spikes
    .filter((s) => time - s.at < SPIKE_SECONDS && time >= s.at - 1)
    .sort((a, b) => Number(b.lane) - Number(a.lane) || b.at - a.at)
    .slice(0, MAX_SHOWN);
}

/** Made-up notices so the box has something to show while the player arranges it. */
export function sampleSpikes(time: number): Spike[] {
  return [
    { id: "sample:L6", champion: "Zed", lane: true, at: time, kind: "level", level: 6 },
    { id: "sample:I6692", champion: "Vi", lane: false, at: time, kind: "item", itemId: 6692 },
  ];
}
