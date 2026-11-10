type Ranked = { championId: number };

export type RankNote = {
  /** 1-based place in the player's own rank. */
  place: number;
  /** 1-based place in the Emerald+ suggestions, or null when it isn't among them. */
  baseline: number | null;
};

/** A pick must climb at least this many places, or be missing from Emerald+, to be worth a line. */
const MIN_CLIMB = 2;

/**
 * Where the rank filter changes the order: picks that stand clearly higher in
 * the player's rank than in the Emerald+ suggestions, or that Emerald+ doesn't
 * suggest at all. Picks that fall, or move a place, get no line.
 */
export function rankNotes(own: Ranked[], baseline: Ranked[]): Map<number, RankNote> {
  const notes = new Map<number, RankNote>();
  own.forEach((pick, index) => {
    const at = baseline.findIndex((b) => b.championId === pick.championId);
    if (at === -1 || at - index >= MIN_CLIMB) notes.set(pick.championId, { place: index + 1, baseline: at === -1 ? null : at + 1 });
  });
  return notes;
}
