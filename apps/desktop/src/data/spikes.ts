export const SPIKE_LEVELS = [2, 3, 6, 11, 16] as const;

export type Spike = { level: number; slot: "Q" | "W" | "E" | "R"; rank: number };

const SLOT_KEYS = ["", "Q", "W", "E", "R"] as const;

/**
 * What a champion gains at the levels that matter: the second and third
 * ability from its usual skill order, then the ultimate's three ranks.
 * Without a skill order only the ultimate levels are known.
 */
export function spikesFor(firstLevels: number[] | null | undefined): Spike[] {
  const spikes: Spike[] = [];
  for (const level of SPIKE_LEVELS) {
    if (level === 6) spikes.push({ level, slot: "R", rank: 1 });
    else if (level === 11) spikes.push({ level, slot: "R", rank: 2 });
    else if (level === 16) spikes.push({ level, slot: "R", rank: 3 });
    else {
      const slot = SLOT_KEYS[firstLevels?.[level - 1] ?? 0];
      if (slot && slot !== "R") spikes.push({ level, slot, rank: 1 });
    }
  }
  return spikes;
}
