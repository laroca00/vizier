import type { Timer } from "./live";

// Where timers are drawn on the game's minimap. The minimap sits flush in a
// bottom corner; its size follows the player's minimap scale option in the
// game, so Vizier asks for a matching value instead of reading it.
// The spots below are Vizier's own rough readings of Summoner's Rift, as
// fractions of the minimap from its top-left corner with the blue base at the
// bottom-left. The red side is the same map turned half a circle.

export type MinimapSide = "left" | "right";
export type MinimapBox = { left: number; top: number; size: number };
type Point = { x: number; y: number };

/** Minimap edge as a share of the screen height at the game's smallest and largest scale. */
const SMALLEST = 0.18;
const LARGEST = 0.34;

/** `size` is 0 to 1, as on the settings slider. */
export function minimapBox(screen: { width: number; height: number }, side: MinimapSide, size: number): MinimapBox {
  const edge = Math.round(screen.height * (SMALLEST + (LARGEST - SMALLEST) * Math.min(1, Math.max(0, size))));
  return { left: side === "left" ? 0 : screen.width - edge, top: screen.height - edge, size: edge };
}

const turn = (p: Point): Point => ({ x: 1 - p.x, y: 1 - p.y });

export const OBJECTIVE_SPOTS = { dragon: { x: 0.69, y: 0.68 }, baron: { x: 0.31, y: 0.32 } } as const;

/** Blue side inhibitors; the red side's are the same points turned. */
const BLUE_INHIBITORS = { top: { x: 0.09, y: 0.55 }, mid: { x: 0.28, y: 0.74 }, bot: { x: 0.45, y: 0.91 } } as const;

/** Blue side camps; a camp key matches the manual timer shortcuts. */
const BLUE_CAMPS: Record<string, Point> = {
  blue: { x: 0.22, y: 0.5 },
  gromp: { x: 0.13, y: 0.4 },
  wolves: { x: 0.2, y: 0.64 },
  red: { x: 0.54, y: 0.82 },
  raptors: { x: 0.46, y: 0.68 },
  krugs: { x: 0.66, y: 0.87 },
  scuttle: { x: 0.37, y: 0.41 },
};

export const CAMP_KEYS = Object.keys(BLUE_CAMPS);

/** Which jungle the manual camp timers are drawn in. */
export type CampSide = "enemy" | "own";

export function campSpot(key: string, myTeam: string, side: CampSide): Point | null {
  const blue = BLUE_CAMPS[key];
  if (!blue) return null;
  const mineIsBlue = myTeam === "ORDER";
  // Blue side camps are the blue team's; the red team's are the same points turned.
  const useBlue = side === "own" ? mineIsBlue : !mineIsBlue;
  return useBlue ? blue : turn(blue);
}

export function timerSpot(timer: Timer, myTeam: string): Point | null {
  if (timer.kind === "dragon") return OBJECTIVE_SPOTS.dragon;
  if (timer.kind === "baron") return OBJECTIVE_SPOTS.baron;
  const blue = BLUE_INHIBITORS[timer.lane ?? "mid"];
  // `ours` says whose inhibitor it is; the blue team owns the blue points.
  const blueOwns = (timer.ours === true) === (myTeam === "ORDER");
  return blueOwns ? blue : turn(blue);
}

/** A spot as pixels on the screen. */
export function onScreen(point: Point, box: MinimapBox): { left: number; top: number } {
  return { left: Math.round(box.left + point.x * box.size), top: Math.round(box.top + point.y * box.size) };
}
