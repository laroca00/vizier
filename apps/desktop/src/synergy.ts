export type Ally = { championId: number; position: string; games: number; winRate: number };
export type AllyGroup = { position: string; duo: boolean; allies: Ally[] };

/** The lane partner whose pairing matters most for a role. */
export const DUO_PARTNER: Record<string, string> = { BOTTOM: "UTILITY", UTILITY: "BOTTOM", JUNGLE: "MIDDLE", MIDDLE: "JUNGLE" };

// Under this many games a pairing's win rate is noise.
export const MIN_ALLY_GAMES = 20;
const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

/** Teammates grouped by role, the duo partner role first, best win rate first, thin pairings left out. */
export function groupAllies(allies: Ally[], position: string, perRole = 3): AllyGroup[] {
  const duoRole = DUO_PARTNER[position];
  const byRole = new Map<string, Ally[]>();
  for (const a of allies) {
    if (a.games < MIN_ALLY_GAMES) continue;
    byRole.set(a.position, [...(byRole.get(a.position) ?? []), a]);
  }
  return ROLE_ORDER.filter((role) => byRole.has(role))
    .map((role) => ({
      position: role,
      duo: role === duoRole,
      allies: byRole.get(role)!.sort((a, b) => b.winRate - a.winRate || b.games - a.games).slice(0, perRole),
    }))
    .sort((a, b) => Number(b.duo) - Number(a.duo));
}
