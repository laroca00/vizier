// Pure calculations behind the overlay, from the Live Client Data the game
// already shows the player plus Vizier's own pre-game stats.

export type LivePlayer = {
  riotId: string;
  rawChampionName: string;
  team: "ORDER" | "CHAOS" | string;
  position: string;
  level: number;
  items: { itemId: number; count: number }[];
  scores: { kills: number; deaths: number; assists: number; creepScore: number };
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

// Respawn delays after a kill. Riot changes these now and then; patch them here.
const DRAGON_RESPAWN = 300;
const ELDER_RESPAWN = 360;
const BARON_RESPAWN = 360;
const INHIBITOR_RESPAWN = 300;

export type Timer = { id: string; label: string; at: number; ours: boolean | null };

const LANES: Record<string, string> = { L: "üst", C: "orta", R: "alt" };

/** Respawn countdowns from kills the game announced. */
export function objectiveTimers(game: LiveGame, myTeam: string): Timer[] {
  const timers: Timer[] = [];
  const last = (name: string) => game.events.filter((e) => e.name === name).pop();

  const dragon = last("DragonKill");
  if (dragon) {
    const elder = dragon.dragonType === "Elder";
    timers.push({ id: "dragon", label: "Ejder", at: dragon.time + (elder ? ELDER_RESPAWN : DRAGON_RESPAWN), ours: null });
  }
  const baron = last("BaronKill");
  if (baron) timers.push({ id: "baron", label: "Baron", at: baron.time + BARON_RESPAWN, ours: null });

  // "Barracks_T2_C1": T1 is the blue side (ORDER), T2 red (CHAOS); L, C, R are top, mid, bottom.
  const inhibitors = new Map<string, LiveEvent>();
  for (const e of game.events) if (e.name === "InhibKilled" && e.inhibKilled) inhibitors.set(e.inhibKilled, e);
  for (const [name, e] of inhibitors) {
    const match = /_T([12])_([LCR])/.exec(name);
    if (!match) continue;
    const ours = (match[1] === "1") === (myTeam === "ORDER");
    timers.push({
      id: name,
      label: `${ours ? "Bizim" : "Rakip"} ${LANES[match[2]]} inhibitör`,
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

export function myNumbers(game: LiveGame) {
  const me = findMe(game);
  if (!me) return null;
  const minutes = game.gameTime / 60;
  const teamKills = game.players.filter((p) => p.team === me.team).reduce((sum, p) => sum + p.scores.kills, 0);
  const { kills, deaths, assists, creepScore } = me.scores;
  return {
    csPerMinute: minutes >= 2 ? creepScore / minutes : null,
    killParticipation: teamKills > 0 ? (kills + assists) / teamKills : null,
    kda: (kills + assists) / Math.max(1, deaths),
  };
}
