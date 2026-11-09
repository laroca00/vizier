import { archetypesOf, type Archetype } from "../data/archetypes";
import type { Champion } from "../data/ddragon";
import { synergyReasons, type SynergyCategory } from "../data/synergyReasons";
import { teamDamage, traitsOf, type DamageProfile } from "../data/traits";

export type PlannerCount = "engage" | "disengage" | "frontline" | "hardCc" | "scaling";

export type PlannerReport = {
  picks: { champion: Champion; archetypes: Archetype[] }[];
  /** Who brings each of the counted things. */
  counts: Record<PlannerCount, string[]>;
  damage: DamageProfile;
  pairs: { a: Champion; b: Champion; reasons: SynergyCategory[] }[];
  /** Plain gap lines, only once most of the team is in. */
  gaps: GapLine[];
};

export type GapLine = "noEngage" | "noDisengage" | "noFrontline" | "littleCc" | "allPhysical" | "allMagic" | "noScaling" | "carryUnprotected";

export const GAP_TEXT: Record<GapLine, string> = {
  noEngage: "Güvenilir engage az: savaşı başlatacak biri yok.",
  noDisengage: "Dalışa karşı geri çekilme aracı yok.",
  noFrontline: "Ön hat yok: hasarı karşılayacak biri eksik.",
  littleCc: "Sert kontrol az: yakalanan hedef kaçabilir.",
  allPhysical: "Hasar neredeyse hep fiziksel: zırh almak yeter.",
  allMagic: "Hasar neredeyse hep büyü: büyü direnci almak yeter.",
  noScaling: "Geç oyuna güvenecek isim yok: oyun uzarsa avantaj kalmaz.",
  carryUnprotected: "Taşıyıcıyı koruyan yok: dalış doğrudan ona ulaşır.",
};

/** A gap is only named once this many champions are in; a smaller team says little. */
export const GAP_MIN_TEAM = 4;

const CARRIES = new Set(["hypercarry", "artillery", "lanebully"]);

export function planTeam(team: Champion[]): PlannerReport {
  const traits = team.map((c) => ({ c, t: traitsOf(c) }));
  const names = (test: (t: ReturnType<typeof traitsOf>) => boolean) => traits.filter((x) => test(x.t)).map((x) => x.c.name);
  const counts: Record<PlannerCount, string[]> = {
    engage: names((t) => t.engage),
    disengage: names((t) => t.disengage),
    frontline: names((t) => t.frontline),
    hardCc: names((t) => t.hardCc),
    scaling: names((t) => t.phase === "late"),
  };
  const damage = teamDamage(team);
  const pairs = team.flatMap((a, i) => team.slice(i + 1).map((b) => ({ a, b, reasons: synergyReasons(a, b) }))).filter((p) => p.reasons.length > 0);
  const gaps: GapLine[] = [];
  if (team.length >= GAP_MIN_TEAM) {
    if (counts.engage.length === 0) gaps.push("noEngage");
    if (counts.disengage.length === 0) gaps.push("noDisengage");
    if (counts.frontline.length === 0) gaps.push("noFrontline");
    if (counts.hardCc.length < 2) gaps.push("littleCc");
    if (damage.ad >= 0.8) gaps.push("allPhysical");
    if (damage.ap >= 0.8) gaps.push("allMagic");
    if (counts.scaling.length === 0) gaps.push("noScaling");
    const hasCarry = team.some((c) => archetypesOf(c.id).some((a) => CARRIES.has(a.id)));
    if (hasCarry && !traits.some((x) => x.t.peel)) gaps.push("carryUnprotected");
  }
  return { picks: team.map((champion) => ({ champion, archetypes: archetypesOf(champion.id) })), counts, damage, pairs, gaps };
}
