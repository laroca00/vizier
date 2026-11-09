import { archetypesOf } from "./archetypes";
import type { Champion } from "./ddragon";
import { traitsOf } from "./traits";

// Why two champions work together, from rules over the hand-kept traits and
// archetypes. A reason is Vizier's reading, not a result: it never says a
// pair wins, only what the pair is built to do.

export type SynergyCategory = "engage" | "wombo" | "protect" | "dive" | "poke" | "scaling" | "lanePressure" | "disengage";

export const SYNERGY_CATEGORIES: SynergyCategory[] = ["engage", "wombo", "protect", "dive", "poke", "scaling", "lanePressure", "disengage"];

export const SYNERGY_TEXT: Record<SynergyCategory, { name: string; reason: string }> = {
  engage: { name: "Başlatma ve kontrol", reason: "Biri savaşı başlatır, diğeri yakalanan hedefe kontrol ekler." },
  wombo: { name: "Toplu savaş", reason: "İkisi de toplu savaşta birden çok hedefe vurur; yan yana güçlenirler." },
  protect: { name: "Taşıyıcıyı koruma", reason: "Biri hasarı verir, diğeri onu dalışlardan korur." },
  dive: { name: "Dalış", reason: "İkisi de rakibin arka hattına girebilir; birlikte tek hedefi hızla düşürürler." },
  poke: { name: "Uzaktan yıpratma", reason: "İkisi de savaştan önce rakibi yıpratır; kuşatma ve obje beklemesi için uygun." },
  scaling: { name: "Geç oyun", reason: "İkisi de oyun uzadıkça güçlenir; erken oyunu sağ atlatmak yeter." },
  lanePressure: { name: "Koridor baskısı", reason: "İkisi de erken oyunda güçlü; koridoru birlikte ezebilirler." },
  disengage: { name: "Geri çekilme", reason: "Biri dalışı püskürtür, diğeri arkadan rahatça hasar verir." },
};

const CARRIES = new Set(["hypercarry", "artillery", "lanebully"]);
const PROTECTORS = new Set(["enchanter", "warden"]);
const DIVERS = new Set(["diver", "assassin"]);

const has = (c: Champion, ids: Set<string>) => archetypesOf(c.id).some((a) => ids.has(a.id));

/** The reasons the pair works, strongest rules first; empty when no rule fits. */
export function synergyReasons(a: Champion, b: Champion): SynergyCategory[] {
  const ta = traitsOf(a);
  const tb = traitsOf(b);
  const out: SynergyCategory[] = [];
  if ((ta.engage && tb.hardCc) || (tb.engage && ta.hardCc)) out.push("engage");
  if ((has(a, CARRIES) && (tb.peel || has(b, PROTECTORS))) || (has(b, CARRIES) && (ta.peel || has(a, PROTECTORS)))) out.push("protect");
  if (ta.teamfight && tb.teamfight) out.push("wombo");
  if ((ta.engage || has(a, DIVERS)) && (tb.engage || has(b, DIVERS))) out.push("dive");
  if ((ta.disengage && has(b, CARRIES)) || (tb.disengage && has(a, CARRIES))) out.push("disengage");
  if (ta.poke && tb.poke) out.push("poke");
  if (ta.phase === "late" && tb.phase === "late") out.push("scaling");
  if (ta.phase === "early" && tb.phase === "early") out.push("lanePressure");
  return out;
}
