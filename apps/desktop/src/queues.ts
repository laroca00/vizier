// Queues Vizier has stats for. Only ranked solo has roles, matchups and bans.

export const RANKED = 420;
export const ARAM = 450;
export const ARENA = 1700;
export const MAYHEM = 2400;
/** Modes with augments. */
export const AUGMENT_QUEUES = [ARENA, MAYHEM];

export const QUEUES: { id: number; label: string }[] = [
  { id: RANKED, label: "Dereceli" },
  { id: 450, label: "ARAM" },
  { id: ARENA, label: "Arena" },
  { id: MAYHEM, label: "ARAM Mayhem" },
  { id: 1900, label: "URF" },
];

/** Arena has no wins, only placements; a top four finish stands in for one. */
export function winLabel(queue: number) {
  return queue === ARENA ? "İlk 4" : "Kazanma";
}
