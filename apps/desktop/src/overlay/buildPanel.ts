import type { RuneStyle } from "../data/ddragon";

export type PanelItem = { id: number; owned: boolean };

const MAX_ITEMS = 6;

/**
 * The build's finished items in buy order, core first, with the ones the
 * player already carries marked. `finished` keeps components out.
 */
export function panelItems(core: number[], popular: number[], owned: number[], finished: (id: number) => boolean): PanelItem[] {
  const have = new Set(owned);
  return [...new Set([...core, ...popular])]
    .filter(finished)
    .slice(0, MAX_ITEMS)
    .map((id) => ({ id, owned: have.has(id) }));
}

export type PanelRunes = { keystone: { id: number; icon: string; name: string } | null; primary: { icon: string; name: string }[]; secondary: { icon: string; name: string }[] };

/**
 * Icons for a rune page: the first perk is the keystone, then three more from
 * the primary tree and two from the secondary, in the order the build stores them.
 */
export function panelRunes(page: { primaryStyle: number; subStyle: number; perks: number[] } | undefined, styles: Map<number, RuneStyle> | null): PanelRunes | null {
  if (!page || !styles) return null;
  const byId = new Map<number, { icon: string; name: string }>();
  for (const style of styles.values()) for (const slot of style.slots) for (const rune of slot) byId.set(rune.id, rune);
  const pick = (ids: number[]) => ids.flatMap((id) => (byId.get(id) ? [byId.get(id)!] : []));
  const first = page.perks[0] ? byId.get(page.perks[0]) : undefined;
  return {
    keystone: first ? { id: page.perks[0], ...first } : null,
    primary: pick(page.perks.slice(1, 4)),
    secondary: pick(page.perks.slice(4, 6)),
  };
}
