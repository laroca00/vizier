import { archetypesOf, ARCHETYPE_CHAMPIONS } from "./archetypes";

const fold = (text: string) => text.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "");

export type ArchetypeFilter = {
  /** A champion must have every one of these. */
  archetypes: string[];
  query: string;
  /** Data Dragon ids allowed by a role filter; null for no role filter. */
  inRole: Set<string> | null;
};

/** Champions (Data Dragon ids) that match the filter, in table order. */
export function matchChampions(filter: ArchetypeFilter, nameOf: (id: string) => string): string[] {
  const needle = fold(filter.query.trim());
  return ARCHETYPE_CHAMPIONS.filter((id) => {
    if (filter.inRole && !filter.inRole.has(id)) return false;
    if (needle && !fold(nameOf(id)).includes(needle)) return false;
    const have = new Set<string>(archetypesOf(id).map((a) => a.id));
    return filter.archetypes.every((a) => have.has(a));
  });
}
