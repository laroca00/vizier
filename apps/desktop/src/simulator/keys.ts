import { ROLES, type Side } from "./store";

export type Slot = { side: Side; slot: number };

/** Tab walks the ten slots: down one side, then the other, and around. Shift goes back. */
export function cycleSlot(from: Slot | null, backwards = false): Slot {
  const order: Slot[] = (["blue", "red"] as const).flatMap((side) => ROLES.map((_, slot) => ({ side, slot })));
  const at = from ? order.findIndex((s) => s.side === from.side && s.slot === from.slot) : -1;
  if (at < 0) return order[backwards ? order.length - 1 : 0];
  return order[(at + (backwards ? order.length - 1 : 1)) % order.length];
}

/** The first champion in the shown list the draft can still take. */
export function firstPickable<T extends { key: number }>(list: T[], disabled: (championId: number) => boolean): T | undefined {
  return list.find((c) => !disabled(c.key));
}
