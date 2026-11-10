import { wilson } from "./confidence";

export type ObjectiveRate = { key: string; games: number; rate: number; winRate: number; roleRate: number };

export const OBJECTIVE_TEXT: Record<string, string> = {
  d: "İlk ejder",
  g: "İlk larvalar",
  h: "İlk Vadi Habercisi",
  t: "İlk kule",
  c: "İlk kan",
};

/**
 * Objectives the team takes first clearly more often than the role does: the lower end of the
 * 95% interval of the champion's rate is still above the role's rate.
 */
export function strongObjectives(rates: ObjectiveRate[], games: number): string[] {
  return rates.filter((r) => wilson(r.rate, games).low > r.roleRate).map((r) => r.key);
}
