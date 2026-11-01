import { describe, expect, it } from "vitest";
import { sqliteD1 } from "../../api/src/sqliteD1.ts";
import { publishPros } from "./publishPros.ts";

function remote() {
  const statements: { sql: string; params: unknown[] }[] = [];
  return { statements, query: async (sql: string, params: unknown[]) => void statements.push({ sql, params }) };
}

function seed(sqlite: ReturnType<typeof sqliteD1>["sqlite"], from: number, count: number) {
  const insert = sqlite.prepare(
    `INSERT INTO pro_matches (match_id, puuid, player, team, platform, patch, game_start, duration, champion_id,
      team_position, win, kills, deaths, assists, cs, gold, runes, spells, items, grp)
      VALUES (?, 'p', 'Faker', 'T1', 'kr', '16.21', ?, 1800, 103, 'MIDDLE', 1, 1, 1, 1, 200, 12000, 'r', '4,14', '3157', 'worlds')`,
  );
  for (let n = from; n < from + count; n++) insert.run(`KR_${n}`, n);
}

describe("publishPros", () => {
  it("sends new games once and the account list only when it changed", async () => {
    const { sqlite } = sqliteD1();
    sqlite.prepare("INSERT INTO pro_accounts (puuid, player, team, role, platform, riot_id, grp) VALUES ('p', 'Faker', 'T1', 'MIDDLE', 'kr', 'Hide on bush#KR1', 'worlds')").run();
    seed(sqlite, 1, 6);
    const to = remote();

    expect(await publishPros(sqlite, to)).toEqual({ games: 6, accounts: 1 });
    expect(to.statements.every((s) => s.params.length <= 100)).toBe(true);
    expect(await publishPros(sqlite, to)).toEqual({ games: 0, accounts: 0 });

    seed(sqlite, 7, 2);
    expect(await publishPros(sqlite, to)).toEqual({ games: 2, accounts: 0 });
  });
});
