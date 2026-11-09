// One rule for how far a win rate can be trusted, shared by every page that
// shows one. It uses the 95% Wilson score interval: with n games and an
// observed rate p, the true rate lies within ± halfWidth of p in 95% of
// samples. Champion and matchup win rates usually differ by a few points, so
// an interval wider than ±10 points says almost nothing.

export type Confidence = "reliable" | "limited" | "insufficient" | "outdated" | "editorial";

/** Half-width limits, in win rate points (0.05 = 5 points). */
export const RELIABLE_HALF_WIDTH = 0.05;
export const LIMITED_HALF_WIDTH = 0.1;
const Z = 1.96;

/** The 95% Wilson interval for a rate observed over `games` games. */
export function wilson(rate: number, games: number): { low: number; high: number; halfWidth: number } {
  if (games <= 0) return { low: 0, high: 1, halfWidth: 0.5 };
  const p = Math.min(1, Math.max(0, rate));
  const z2 = Z * Z;
  const centre = (p + z2 / (2 * games)) / (1 + z2 / games);
  const spread = (Z * Math.sqrt((p * (1 - p)) / games + z2 / (4 * games * games))) / (1 + z2 / games);
  return { low: Math.max(0, centre - spread), high: Math.min(1, centre + spread), halfWidth: spread };
}

/** "16.22.1" or "16.22" -> "16.22", so Data Dragon versions and API patches compare. */
export function patchOf(version: string): string {
  return version.split(".").slice(0, 2).join(".");
}

export type Sample = {
  games: number;
  winRate: number;
  /** Patches the numbers come from, as the API sends them. */
  patches?: string[];
  /** The newest game patch, from Data Dragon. When it isn't in `patches` the data is outdated. */
  currentPatch?: string | null;
};

export function confidenceOf({ games, winRate, patches, currentPatch }: Sample): Confidence {
  if (currentPatch && patches && patches.length > 0 && !patches.map(patchOf).includes(patchOf(currentPatch))) return "outdated";
  const { halfWidth } = wilson(winRate, games);
  if (halfWidth <= RELIABLE_HALF_WIDTH) return "reliable";
  if (halfWidth <= LIMITED_HALF_WIDTH) return "limited";
  return "insufficient";
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  reliable: "Güvenilir veri",
  limited: "Sınırlı örneklem",
  insufficient: "Yetersiz veri",
  outdated: "Eski veri",
  editorial: "Vizier değerlendirmesi",
};

/** The one cut-off for showing a win rate as a fact: its interval must be narrow enough to mean something. */
export function hasEnoughGames(games: number, winRate: number): boolean {
  return confidenceOf({ games, winRate }) !== "insufficient";
}
