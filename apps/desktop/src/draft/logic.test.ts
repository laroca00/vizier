import { describe, expect, it } from "vitest";
import type { ProBuild, TierEntry } from "../api";
import type { Champion } from "../data/ddragon";
import type { ChampSelect, DraftMember } from "../lcu";
import { autoView, hasBench, matchupLine, duoPartnerRole, difficultyOf, guessOpponent, matchupItems, rankProBuilds, suggestPicks, teamNeeds, type RoleShares } from "./logic";

function champion(key: number, id: string, tags: string[], info: Partial<Champion["info"]> = {}): Champion {
  const full = { attack: 5, defense: 5, magic: 5, difficulty: 5, ...info };
  return { id, key, name: id, magic: full.magic > full.attack, tank: tags[0] === "Tank", tags, info: full };
}

const AHRI = champion(103, "Ahri", ["Mage", "Assassin"], { attack: 3, magic: 8, defense: 4 });
const SYNDRA = champion(134, "Syndra", ["Mage"], { attack: 2, magic: 9, defense: 3 });
const ORIANNA = champion(61, "Orianna", ["Mage", "Support"], { attack: 4, magic: 9, defense: 3 });
const ZED = champion(238, "Zed", ["Assassin"], { attack: 9, magic: 1, defense: 2 });
const MALPHITE = champion(54, "Malphite", ["Tank", "Fighter"], { attack: 5, magic: 8, defense: 9 });
const JINX = champion(222, "Jinx", ["Marksman"], { attack: 9, magic: 4, defense: 2 });
const LEESIN = champion(64, "LeeSin", ["Fighter", "Assassin"], { attack: 8, magic: 3, defense: 5 });
const DARIUS = champion(122, "Darius", ["Fighter", "Tank"], { attack: 9, magic: 1, defense: 5 });
const ALL = new Map([AHRI, SYNDRA, ORIANNA, ZED, MALPHITE, JINX, LEESIN, DARIUS].map((c) => [c.key, c]));

function member(over: Partial<DraftMember>): DraftMember {
  return { cellId: 0, championId: 0, pickIntent: 0, position: "middle", spells: [4, 14], isLocal: true, ...over };
}

function draft(over: Partial<ChampSelect>, me: Partial<DraftMember> = {}): ChampSelect {
  return { myTeam: [member(me)], theirTeam: [], bans: [], phase: "BAN_PICK", turn: null, phaseEndsAt: 0, ...over };
}

describe("autoView", () => {
  it("shows the draft while banning and while others pick", () => {
    expect(autoView(draft({ turn: { kind: "ban", mine: true } }, { pickIntent: 103 })).view).toBe("draft");
    expect(autoView(draft({ turn: { kind: "pick", mine: false } }, { pickIntent: 103 })).view).toBe("draft");
    expect(autoView(draft({ phase: "PLANNING" }, { pickIntent: 103 })).view).toBe("draft");
  });

  it("previews the build on my pick turn and after locking", () => {
    expect(autoView(draft({ turn: { kind: "pick", mine: true } }, { pickIntent: 103 })).view).toBe("build");
    expect(autoView(draft({ turn: { kind: "pick", mine: true } })).view).toBe("draft");
    expect(autoView(draft({ phase: "FINALIZATION" }, { championId: 103 })).view).toBe("build");
  });

  it("moves the moment on when the turn changes, not when the hover changes", () => {
    const a = autoView(draft({ turn: { kind: "pick", mine: true } }, { pickIntent: 103 })).moment;
    const b = autoView(draft({ turn: { kind: "pick", mine: true } }, { pickIntent: 134 })).moment;
    const c = autoView(draft({ turn: { kind: "pick", mine: true } }, { championId: 134, pickIntent: 134 })).moment;
    expect(a).toBe(b);
    expect(c).not.toBe(b);
  });
});

describe("guessOpponent", () => {
  const shares: RoleShares = new Map([
    [238, new Map([["MIDDLE", 0.8], ["JUNGLE", 0.05]])],
    [64, new Map([["JUNGLE", 0.9], ["MIDDLE", 0.02]])],
    [122, new Map([["TOP", 0.9]])],
    [61, new Map([["MIDDLE", 0.7], ["UTILITY", 0.3]])],
  ]);

  it("finds the enemy who usually plays my role", () => {
    expect(guessOpponent([122, 64, 238], "MIDDLE", shares)).toBe(238);
  });

  it("assigns the whole team, so a flex pick moves to its other role", () => {
    expect(guessOpponent([238, 61], "UTILITY", shares)).toBe(61);
    expect(guessOpponent([238, 61], "MIDDLE", shares)).toBe(238);
  });

  it("gives no guess when nobody plays the role", () => {
    expect(guessOpponent([122, 64], "BOTTOM", shares)).toBeNull();
    expect(guessOpponent([], "MIDDLE", shares)).toBeNull();
  });
});

function pro(opponentChampionId: number | null, gameStart: number): ProBuild {
  return {
    matchId: `m${gameStart}`, player: "p", team: "t", platform: "kr", patch: "26.21", gameStart, duration: 1800,
    championId: 103, opponentChampionId, position: "MIDDLE", win: true, kills: 1, deaths: 1, assists: 1, cs: 200, gold: 1,
    runes: "8100:8300:1,2,3,4:5,6:7,8,9", spells: [4, 14], items: [], startItems: [], skillOrder: [], purchases: [],
  };
}

describe("rankProBuilds", () => {
  it("puts the same opponent first, then the same class and damage, then the same damage", () => {
    const ranked = rankProBuilds([pro(238, 5), pro(61, 4), pro(134, 1), pro(54, 3), pro(null, 9)], 134, ALL);
    expect(ranked.map((r) => [r.build.opponentChampionId, r.match])).toEqual([
      [134, "exact"],
      [61, "class"],
      [54, "damage"],
      [null, "any"],
      [238, "any"],
    ]);
  });

  it("drops a game listed twice", () => {
    expect(rankProBuilds([pro(238, 1), pro(238, 1), pro(61, 3)], null, ALL)).toHaveLength(2);
  });

  it("orders by date without an opponent", () => {
    expect(rankProBuilds([pro(238, 1), pro(61, 3)], null, ALL).map((r) => r.build.gameStart)).toEqual([3, 1]);
  });
});

describe("teamNeeds", () => {
  it("waits for two allies", () => {
    expect(teamNeeds([ZED])).toEqual([]);
  });

  it("asks for magic damage and a frontline when the team lacks them", () => {
    const needs = teamNeeds([ZED, JINX]);
    expect(needs).toContain("ap");
    expect(needs).toContain("frontline");
  });
});

function entry(championId: number, winRate: number, tier = "B"): TierEntry {
  return { championId, games: 1000, winRate, pickRate: 0.05, tier, winRateChange: null };
}

describe("suggestPicks", () => {
  it("ranks counters to the lane opponent and explains why", () => {
    const picks = suggestPicks({
      tierList: [entry(103, 0.5), entry(61, 0.5), entry(134, 0.5)],
      opponentCounters: { patches: [], games: 0, matchups: [{ championId: 61, games: 200, winRate: 0.44 }] },
      opponentId: 238,
      allies: [],
      champions: ALL,
      unavailable: new Set(),
    });
    expect(picks[0].championId).toBe(61);
    expect(picks[0].reasons[0]).toMatchObject({ kind: "counter", vs: 238, games: 200 });
    expect(picks[0].reasons[0].kind === "counter" && picks[0].reasons[0].winRate).toBeCloseTo(0.56);
  });

  it("skips banned champions and those with nothing to say for them", () => {
    const picks = suggestPicks({
      tierList: [entry(103, 0.53, "S"), entry(134, 0.5)],
      opponentCounters: null,
      opponentId: null,
      allies: [],
      champions: ALL,
      unavailable: new Set([103]),
    });
    expect(picks).toEqual([]);
  });

  it("rewards filling the team's gaps", () => {
    const picks = suggestPicks({
      tierList: [entry(238, 0.5), entry(54, 0.5)],
      opponentCounters: null,
      opponentId: null,
      allies: [JINX, LEESIN],
      champions: ALL,
      unavailable: new Set(),
    });
    expect(picks[0].championId).toBe(54);
    expect(picks[0].reasons.map((r) => r.kind === "need" && r.need)).toContain("ap");
  });
});

describe("matchup helpers", () => {
  it("reads difficulty from the win rate", () => {
    expect(difficultyOf(0.45)).toBe("hard");
    expect(difficultyOf(0.5)).toBe("even");
    expect(difficultyOf(0.55)).toBe("easy");
  });

  it("finds items bought more against this opponent", () => {
    const general = { games: 100, items: [{ id: 1, games: 50 }, { id: 2, games: 5 }] };
    const versus = { games: 20, items: [{ id: 1, games: 10 }, { id: 2, games: 8 }, { id: 3, games: 3 }] };
    expect(matchupItems(general, versus)).toEqual([2, 3]);
  });
});

describe("suggestPicks pool and breakdown", () => {
  it("lists pool champions first even when nothing else speaks for them", () => {
    const picks = suggestPicks({
      tierList: [entry(103, 0.53, "S"), entry(134, 0.5, "B")],
      opponentCounters: null,
      opponentId: null,
      allies: [],
      champions: ALL,
      unavailable: new Set(),
      pool: new Set([134]),
    });
    expect(picks.map((p) => p.championId)).toEqual([134, 103]);
    expect(picks[0].inPool).toBe(true);
    expect(picks[1].inPool).toBe(false);
  });

  it("splits the score into its parts", () => {
    const picks = suggestPicks({
      tierList: [entry(61, 0.52)],
      opponentCounters: { patches: [], games: 0, matchups: [{ championId: 61, games: 200, winRate: 0.44 }] },
      opponentId: 238,
      allies: [JINX, LEESIN],
      champions: ALL,
      unavailable: new Set(),
    });
    const [pick] = picks;
    expect(pick.breakdown.meta).toBeCloseTo(2);
    expect(pick.breakdown.counter).toBeCloseTo(9);
    expect(pick.score).toBeCloseTo(pick.breakdown.meta + pick.breakdown.counter + pick.breakdown.needs);
  });
});

describe("duoPartnerRole", () => {
  it("pairs bot with support and jungle with mid", () => {
    expect(duoPartnerRole("bottom")).toBe("UTILITY");
    expect(duoPartnerRole("UTILITY")).toBe("BOTTOM");
    expect(duoPartnerRole("JUNGLE")).toBe("MIDDLE");
    expect(duoPartnerRole("MIDDLE")).toBe("JUNGLE");
  });

  it("has no partner for top or an unknown role", () => {
    expect(duoPartnerRole("TOP")).toBeNull();
    expect(duoPartnerRole("")).toBeNull();
    expect(duoPartnerRole(undefined)).toBeNull();
  });
});

describe("matchupLine", () => {
  const counters = { matchups: [{ championId: 1, games: 120, winRate: 0.45 }, { championId: 2, games: 10, winRate: 0.7 }] };

  it("reads the win rate, games and difficulty", () => {
    expect(matchupLine(counters, 1)).toEqual({ winRate: 0.45, games: 120, difficulty: "hard" });
  });

  it("ignores thin and missing matchups", () => {
    expect(matchupLine(counters, 2)).toBeNull();
    expect(matchupLine(counters, 3)).toBeNull();
  });
});

describe("hasBench", () => {
  it("is true once the session lists a bench or rerolls", () => {
    expect(hasBench(draft({ bench: [103] }))).toBe(true);
    expect(hasBench(draft({ rerollsRemaining: 1 }))).toBe(true);
  });

  it("is false for sessions without one", () => {
    expect(hasBench(draft({}))).toBe(false);
    expect(hasBench(draft({ bench: [], rerollsRemaining: 0 }))).toBe(false);
  });
});
