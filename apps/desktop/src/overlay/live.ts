// Pure calculations behind the overlay, from the Live Client Data the game
// already shows the player plus Vizier's own pre-game stats.

export type LivePlayer = {
  riotId: string;
  rawChampionName: string;
  team: "ORDER" | "CHAOS" | string;
  position: string;
  level: number;
  items: { itemId: number; count: number }[];
  scores: { kills: number; deaths: number; assists: number; creepScore: number; wardScore?: number };
  /** Missing from builds of the app before they were sent. */
  isDead?: boolean;
  /** Seconds until respawn; only meaningful while `isDead`. */
  respawnTimer?: number;
};

export type LiveEvent = {
  name: "DragonKill" | "BaronKill" | "HeraldKill" | "InhibKilled" | string;
  time: number;
  dragonType: string | null;
  inhibKilled: string | null;
  killerName: string | null;
};

export type LiveGame = {
  gameTime: number;
  gameMode: string;
  me: string;
  level: number;
  /** Unspent gold; missing from builds of the app before it was sent. */
  gold?: number;
  /** Ranks of Q, W, E and R. */
  skills: [number, number, number, number];
  players: LivePlayer[];
  events: LiveEvent[];
};

/** "game_character_displayname_MonkeyKing" -> "MonkeyKing", the Data Dragon id. */
export function championKey(player: LivePlayer) {
  return player.rawChampionName.replace(/^game_character_displayname_/, "");
}

export function findMe(game: LiveGame): LivePlayer | undefined {
  return game.players.find((p) => p.riotId === game.me) ?? game.players[0];
}

const SLOTS = ["Q", "W", "E", "R"] as const;
export type SkillKey = (typeof SLOTS)[number];

/**
 * The skill to rank up now, or null when no point is waiting.
 * `firstLevels` and `maxOrder` use slots 1-3 for Q, W and E, as the build API does.
 */
export function nextSkill(level: number, skills: number[], build: { firstLevels: number[]; maxOrder: number[] } | null): SkillKey | null {
  const spent = skills.reduce((sum, n) => sum + n, 0);
  if (spent >= level) return null;
  const [q, w, e, r] = skills;
  // R unlocks at 6, 11 and 16.
  if (r < [6, 11, 16].filter((at) => level >= at).length) return "R";
  if (!build) return null;
  // A basic ability can't go above half the champion level, rounded up.
  const cap = Math.ceil(level / 2);
  const basics = [q, w, e];
  const canRank = (slot: number) => basics[slot - 1] < Math.min(5, cap);
  const early = build.firstLevels[q + w + e];
  if (q + w + e < build.firstLevels.length && early && canRank(early)) return SLOTS[early - 1];
  const slot = build.maxOrder.find(canRank);
  return slot ? SLOTS[slot - 1] : null;
}

/**
 * The full 18-level order, played out with the same rules the overlay uses:
 * the first levels as picked, R whenever it unlocks, then the max order.
 */
export function skillSequence(skills: { firstLevels: number[]; maxOrder: number[] }): SkillKey[] {
  const ranks: [number, number, number, number] = [0, 0, 0, 0];
  const out: SkillKey[] = [];
  for (let level = 1; level <= 18; level++) {
    const key = nextSkill(level, ranks, skills);
    if (!key) break;
    ranks[SLOTS.indexOf(key)]++;
    out.push(key);
  }
  return out;
}

// Respawn delays after a kill. Riot changes these now and then; patch them here.
const DRAGON_RESPAWN = 300;
const ELDER_RESPAWN = 360;
const BARON_RESPAWN = 360;
const INHIBITOR_RESPAWN = 300;

export type Timer = { id: string; kind: "dragon" | "baron" | "inhibitor"; lane?: "top" | "mid" | "bot"; at: number; ours: boolean | null };

const LANES = { L: "top", C: "mid", R: "bot" } as const;

/** Respawn countdowns from kills the game announced. */
export function objectiveTimers(game: LiveGame, myTeam: string): Timer[] {
  const timers: Timer[] = [];
  const last = (name: string) => game.events.filter((e) => e.name === name).pop();

  const dragon = last("DragonKill");
  if (dragon) {
    const elder = dragon.dragonType === "Elder";
    timers.push({ id: "dragon", kind: "dragon", at: dragon.time + (elder ? ELDER_RESPAWN : DRAGON_RESPAWN), ours: null });
  }
  const baron = last("BaronKill");
  if (baron) timers.push({ id: "baron", kind: "baron", at: baron.time + BARON_RESPAWN, ours: null });

  // "Barracks_T2_C1": T1 is the blue side (ORDER), T2 red (CHAOS); L, C, R are top, mid, bottom.
  const inhibitors = new Map<string, LiveEvent>();
  for (const e of game.events) if (e.name === "InhibKilled" && e.inhibKilled) inhibitors.set(e.inhibKilled, e);
  for (const [name, e] of inhibitors) {
    const match = /_T([12])_([LCR])/.exec(name);
    if (!match) continue;
    const ours = (match[1] === "1") === (myTeam === "ORDER");
    timers.push({
      id: name,
      kind: "inhibitor",
      lane: LANES[match[2] as keyof typeof LANES],
      at: e.time + INHIBITOR_RESPAWN,
      ours,
    });
  }
  return timers.filter((t) => t.at > game.gameTime).sort((a, b) => a.at - b.at);
}

export function clock(seconds: number) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function itemValue(player: LivePlayer, gold: (itemId: number) => number) {
  return player.items.reduce((sum, item) => sum + gold(item.itemId) * Math.max(1, item.count), 0);
}

/** Gold in items for my lane and for the whole team, against the enemy's. */
export function itemDifference(game: LiveGame, gold: (itemId: number) => number) {
  const me = findMe(game);
  if (!me) return null;
  const team = (side: string) => game.players.filter((p) => p.team === side).reduce((sum, p) => sum + itemValue(p, gold), 0);
  const enemySide = game.players.find((p) => p.team !== me.team)?.team;
  if (!enemySide) return null;
  const opponent = me.position ? game.players.find((p) => p.team === enemySide && p.position === me.position) : undefined;
  return {
    lane: opponent ? itemValue(me, gold) - itemValue(opponent, gold) : null,
    opponent,
    team: team(me.team) - team(enemySide),
  };
}

const ROLE_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

export type ScoreboardRow = { ally: LivePlayer; enemy: LivePlayer | undefined; diff: number | null };

/**
 * Item gold of each ally against the enemy in the same role, top to support,
 * the order the scoreboard lists them in. Without roles (ARAM, Arena) the
 * game's own order pairs them.
 */
export function scoreboardRows(game: LiveGame, gold: (itemId: number) => number): ScoreboardRow[] {
  const me = findMe(game);
  if (!me) return [];
  const allies = game.players.filter((p) => p.team === me.team);
  const enemies = game.players.filter((p) => p.team !== me.team);
  const byRole = allies.every((p) => ROLE_ORDER.includes(p.position));
  const ordered = byRole ? [...allies].sort((a, b) => ROLE_ORDER.indexOf(a.position) - ROLE_ORDER.indexOf(b.position)) : allies;
  return ordered.map((ally, i) => {
    const enemy = byRole ? enemies.find((e) => e.position === ally.position) : enemies[i];
    return { ally, enemy, diff: enemy ? itemValue(ally, gold) - itemValue(enemy, gold) : null };
  });
}

/** The first item of the build the player doesn't own yet. */
export function nextItem(owned: number[], build: number[]): number | null {
  const have = new Set(owned);
  return build.find((id) => !have.has(id)) ?? null;
}
