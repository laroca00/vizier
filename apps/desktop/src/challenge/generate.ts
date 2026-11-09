import type { Champion } from "../data/ddragon";
import { damageProfile, teamDamage, traitsOf } from "../data/traits";
import { archetypesOf } from "../data/archetypes";
import text from "./generatedText.json";
import { shuffled } from "./session";
import { SLOT_ROLES, type Answer, type Scenario, type SlotRole, type Text } from "./scenarios";

// Scenarios built from the same rules the planner uses, so the pool does not
// depend on hand writing. The accepted and rejected lists are the rule's own
// verdict on every champion that suits the role, so any pick can be graded.

export type GeneratedKind = "noEngage" | "allPhysical" | "allMagic" | "heavyDive";
export const GENERATED_KINDS: GeneratedKind[] = ["noEngage", "allPhysical", "allMagic", "heavyDive"];

/** A rough fit of a champion to a lane, from its Data Dragon classes. */
export function suits(role: SlotRole, c: Champion): boolean {
  const main = c.tags[0];
  switch (role) {
    case "TOP":
      return main === "Fighter" || main === "Tank";
    case "JUNGLE":
      return main === "Fighter" || main === "Assassin" || main === "Tank";
    case "MIDDLE":
      return main === "Mage" || main === "Assassin";
    case "BOTTOM":
      return main === "Marksman";
    case "UTILITY":
      return main === "Support" || (main === "Tank" && c.tags.includes("Support"));
  }
}

const TEXT = text;
const fill = (text: Text, name: string): Text => ({ tr: text.tr.replace("{name}", name), en: text.en.replace("{name}", name) });

const FITS: Record<GeneratedKind, (c: Champion) => boolean> = {
  noEngage: (c) => traitsOf(c).engage,
  allPhysical: (c) => damageProfile(c).ap >= 0.6,
  allMagic: (c) => damageProfile(c).ad >= 0.6,
  heavyDive: (c) => traitsOf(c).peel || traitsOf(c).disengage,
};

type Rule = { fits: (c: Champion) => boolean; question: Text; lesson: Text; yes: (name: string) => Text; no: (name: string) => Text };

const RULES = Object.fromEntries(
  GENERATED_KINDS.map((kind) => {
    const text = TEXT[kind] as Record<"question" | "lesson" | "yes" | "no", Text>;
    const rule: Rule = { fits: FITS[kind], question: text.question, lesson: text.lesson, yes: (n) => fill(text.yes, n), no: (n) => fill(text.no, n) };
    return [kind, rule];
  }),
) as Record<GeneratedKind, Rule>;

const MAX_LIST = 40;
const TRIES = 60;

/** One scenario of the kind, or null when the champion pool cannot make a fair one. */
export function generateScenario(kind: GeneratedKind, champions: Champion[], rng: () => number = Math.random, seed = 0): Scenario | null {
  const rule = RULES[kind];
  const byRole = (role: SlotRole) => champions.filter((c) => suits(role, c));
  for (let attempt = 0; attempt < TRIES; attempt++) {
    const role = SLOT_ROLES[Math.floor(rng() * SLOT_ROLES.length)];
    const used = new Set<string>();
    const draw = (r: SlotRole, ok: (c: Champion) => boolean = () => true) => {
      const pick = shuffled(byRole(r), rng).find((c) => !used.has(c.id) && ok(c));
      if (pick) used.add(pick.id);
      return pick;
    };
    // Teammates are drawn so the gap is real: no engage / one damage type / no protection.
    const mates = new Map<SlotRole, Champion>();
    let valid = true;
    for (const r of SLOT_ROLES) {
      if (r === role) continue;
      const mate =
        kind === "noEngage"
          ? draw(r, (c) => !traitsOf(c).engage)
          : kind === "allPhysical"
            ? draw(r, (c) => damageProfile(c).ad >= 0.7)
            : kind === "allMagic"
              ? draw(r, (c) => damageProfile(c).ap >= 0.7)
              : draw(r, (c) => !traitsOf(c).peel && !traitsOf(c).disengage);
      if (!mate) {
        valid = false;
        break;
      }
      mates.set(r, mate);
    }
    if (!valid) continue;
    const team = [...mates.values()];
    if (kind === "allPhysical" && teamDamage(team).ad < 0.7) continue;
    if (kind === "allMagic" && teamDamage(team).ap < 0.7) continue;
    // The enemy side: for heavyDive, divers where the role has them, and at least two overall.
    const diver = (c: Champion) => archetypesOf(c.id).some((a) => a.id === "diver" || a.id === "assassin") || traitsOf(c).engage;
    const red: (Champion | undefined)[] = SLOT_ROLES.map((r) => (kind === "heavyDive" ? (draw(r, diver) ?? draw(r)) : draw(r)));
    if (red.some((c) => !c)) continue;
    if (kind === "heavyDive" && red.filter((c) => diver(c!)).length < 2) continue;

    const candidates = byRole(role).filter((c) => !used.has(c.id));
    const accepted: Answer[] = candidates.filter(rule.fits).map((c) => ({ champion: c.id, why: rule.yes(c.name) }));
    const rejected: Answer[] = candidates.filter((c) => !rule.fits(c)).map((c) => ({ champion: c.id, why: rule.no(c.name) }));
    if (accepted.length < 2 || rejected.length < 1) continue;

    return {
      id: `gen-${kind}-${seed}`,
      category: kind === "noEngage" ? "engage" : kind === "heavyDive" ? "peel" : "damage",
      difficulty: 2,
      role,
      blue: SLOT_ROLES.map((r) => mates.get(r)?.id ?? null),
      red: red.map((c) => c!.id),
      bans: [],
      question: rule.question,
      lesson: rule.lesson,
      accepted: accepted.slice(0, MAX_LIST),
      rejected: rejected.slice(0, MAX_LIST),
      generated: true,
    };
  }
  return null;
}

/** `count` generated scenarios, kinds taken in turn so each shows up. */
export function generateSet(count: number, champions: Champion[], rng: () => number = Math.random): Scenario[] {
  const out: Scenario[] = [];
  for (let i = 0; i < count; i++) {
    const s = generateScenario(GENERATED_KINDS[i % GENERATED_KINDS.length], champions, rng, i);
    if (s) out.push(s);
  }
  return out;
}
