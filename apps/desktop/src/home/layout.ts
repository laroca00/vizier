// Which Home cards show and in what order; kept in settings.

export const HOME_CARDS = ["lists", "thisPatch", "metaPicks", "metaMovers", "pros"] as const;
export type HomeCard = (typeof HOME_CARDS)[number];
export type HomeLayout = { order: HomeCard[]; hidden: HomeCard[] };

export const DEFAULT_HOME: HomeLayout = { order: [...HOME_CARDS], hidden: [] };

const isCard = (id: unknown): id is HomeCard => typeof id === "string" && (HOME_CARDS as readonly string[]).includes(id);

/** A saved layout made whole: unknown cards dropped, cards added since it was saved put at the end. */
export function normalizeHome(layout: Partial<HomeLayout> | null | undefined): HomeLayout {
  const order = [...new Set((Array.isArray(layout?.order) ? layout.order : []).filter(isCard))];
  for (const card of HOME_CARDS) if (!order.includes(card)) order.push(card);
  const hidden = [...new Set((Array.isArray(layout?.hidden) ? layout.hidden : []).filter(isCard))];
  return { order, hidden };
}

/** Moves a card one step up (-1) or down (1). */
export function moveCard(layout: HomeLayout, card: HomeCard, step: -1 | 1): HomeLayout {
  const order = [...layout.order];
  const at = order.indexOf(card);
  const to = at + step;
  if (at < 0 || to < 0 || to >= order.length) return layout;
  [order[at], order[to]] = [order[to], order[at]];
  return { ...layout, order };
}

export function toggleCard(layout: HomeLayout, card: HomeCard): HomeLayout {
  return { ...layout, hidden: layout.hidden.includes(card) ? layout.hidden.filter((c) => c !== card) : [...layout.hidden, card] };
}
