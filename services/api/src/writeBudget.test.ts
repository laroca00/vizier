import { BRACKETS, REGIONS, REGION_BRACKETS, type Bracket } from "@vizier/shared/brackets";
import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { DAILY_WRITE_LIMIT, OTHER_QUEUES_PER_DAY, PUBLISHES_PER_DAY, VOLATILITY, WRITES_PER_DOC } from "./publishPlan.ts";
import { recordHistory } from "./history.ts";
import { rollup } from "./rollup.ts";
import { regionDocs, splitRank, statDocs } from "./statDocs.ts";
import { fakeD1 } from "./test/fakeD1.ts";

// The live game's size, to scale the fixture's doc counts up to a real patch.
const REAL = { champions: 170, pairs: 340 };
// Docs of the four queues without a ladder: champion and build per champion, a tier list each, augments, Arena duos and items.
const OTHER_QUEUE_DOCS = 4 * (2 * REAL.champions + 1) + 2 * (REAL.champions + 2) + 2 * REAL.champions;
const GROUPS = ["iron_bronze", "silver", "gold", "platinum", "emerald", "diamond", "master_plus"];
const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

/** A fixture where every champion plays one or two roles with games in every group. */
async function fixture(champions: number) {
  const { db, sqlite } = fakeD1();
  const game = sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', ?)");
  const row = sqlite.prepare(
    `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id, rank_group)
     VALUES (?, '16.21', ?, ?, ?, '8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011', '4,14', '3157', ?, 1800, 420, ?, ?)`,
  );
  for (let c = 1; c <= champions; c++) {
    // Every second champion has a second role: 1.5 pairs a champion, near the live game.
    const roles = c % 2 === 0 ? [ROLES[c % 5], ROLES[(c + 1) % 5]] : [ROLES[c % 5]];
    for (const role of roles) {
      for (const [g, group] of GROUPS.entries()) {
        for (let n = 0; n < 40; n++) {
          const id = `EUW1_${c}_${role}_${group}_${n}`;
          game.run(id, group);
          row.run(id, c, role, (n + g) % 2, 1000 + c, 100, group);
          row.run(id, 1000 + c, role, (n + g + 1) % 2, c, 200, group);
        }
      }
    }
  }
  await rollup(db, async () => ({ ...emptyCatalog(), finished: new Set([3157]) }));
  await recordHistory(db);
  return db;
}

type Kinds = Map<string, { fixed: number; champion: number; pair: number }>;
const FIXED_KINDS = ["tierlist", "bans", "coverage", "augments", "augmentchamps", "buildindex", "historytier"];

/** Docs a publish of this bracket sends, split by what they grow with. */
async function shape(db: D1Database, bracket: Bracket) {
  const kinds: Kinds = new Map();
  for await (const [key] of statDocs(db, bracket)) {
    const { base } = splitRank(key);
    const [kind, ...rest] = base.split(":");
    const entry = kinds.get(kind) ?? { fixed: 0, champion: 0, pair: 0 };
    if (FIXED_KINDS.includes(kind)) entry.fixed++;
    else if (kind === "history") entry.champion++;
    else if (rest[rest.length - 1] === "ANY") entry.champion++;
    else entry.pair++;
    kinds.set(kind, entry);
  }
  return kinds;
}

/** The region docs of a bracket by kind. The fixture plays on one platform, so tier lists are scaled to all regions. */
async function regionShape(db: D1Database, bracket: Bracket) {
  const kinds: Kinds = new Map();
  for await (const [key] of regionDocs(db, bracket)) {
    const kind = key.split(":")[0];
    const entry = kinds.get(kind) ?? { fixed: 0, champion: 0, pair: 0 };
    if (kind === "tierregion") entry.fixed += REGIONS.length;
    else entry.champion++;
    kinds.set(kind, entry);
  }
  return kinds;
}

/** Docs per bracket and kind at the live game's size: the fixture's per-champion and per-role counts, scaled. */
function scaled(kinds: Kinds, unit: { champions: number; pairs: number }) {
  return [...kinds].map(([kind, n]) => ({
    kind,
    docs: Math.round((n.fixed + (n.champion / unit.champions) * REAL.champions + (n.pair / unit.pairs) * REAL.pairs) * (VOLATILITY[kind] ?? 1)),
  }));
}

describe("D1 write budget", () => {
  let shapes: Map<Bracket, Kinds>;
  let regions: Map<Bracket, Kinds>;
  let unit: { champions: number; pairs: number };
  beforeAll(async () => {
    const db = await fixture(24);
    shapes = new Map();
    regions = new Map();
    for (const bracket of BRACKETS) shapes.set(bracket, await shape(db, bracket));
    for (const bracket of REGION_BRACKETS) regions.set(bracket, await regionShape(db, bracket));
    // The fixture's own size, read from what Emerald+ publishes.
    const base = shapes.get("emerald_plus")!.get("champion")!;
    unit = { champions: base.champion, pairs: base.pair };
  }, 120_000);

  it("projects a day of publishes inside the limit and prints where the writes go", () => {
    const rows: { bracket: string; kind: string; docs: number; perDay: number; writes: number }[] = [];
    let total = 0;
    for (const bracket of BRACKETS) {
      const perDay = PUBLISHES_PER_DAY[bracket];
      // Worst case: every doc changed since the last publish.
      for (const { kind, docs } of scaled(shapes.get(bracket)!, unit)) {
        const writes = docs * WRITES_PER_DOC * perDay;
        total += writes;
        rows.push({ bracket, kind, docs, perDay, writes });
      }
    }
    // Region docs go out once a day for each region bracket.
    for (const bracket of REGION_BRACKETS) {
      for (const { kind, docs } of scaled(regions.get(bracket)!, unit)) {
        const writes = docs * WRITES_PER_DOC;
        total += writes;
        rows.push({ bracket: `${bracket} (regions)`, kind, docs, perDay: 1, writes });
      }
    }
    // One rank curve doc a day.
    total += WRITES_PER_DOC;
    rows.push({ bracket: "(all)", kind: "rankcurve", docs: 1, perDay: 1, writes: WRITES_PER_DOC });
    const other = OTHER_QUEUE_DOCS * WRITES_PER_DOC * OTHER_QUEUES_PER_DAY;
    total += other;
    rows.push({ bracket: "(other queues)", kind: "all", docs: OTHER_QUEUE_DOCS, perDay: OTHER_QUEUES_PER_DAY, writes: other });
    console.table(rows.filter((r) => r.perDay > 0));
    console.log(`projected D1 row writes a day for stat docs: ${total} of ${DAILY_WRITE_LIMIT}`);
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(DAILY_WRITE_LIMIT);
  });

  it("would fail if every bracket were published at every slot", () => {
    let perPublish = 0;
    for (const bracket of BRACKETS) for (const { docs } of scaled(shapes.get(bracket)!, unit)) perPublish += docs;
    // Six slots a day: the reason brackets other than Emerald+ go out in rotation.
    perPublish += OTHER_QUEUE_DOCS;
    for (const bracket of REGION_BRACKETS) for (const { docs } of scaled(regions.get(bracket)!, unit)) perPublish += docs;
    expect(perPublish * WRITES_PER_DOC * 6).toBeGreaterThan(DAILY_WRITE_LIMIT);
  });
});
