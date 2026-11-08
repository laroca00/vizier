import type { Champion } from "../data/ddragon";
import { traitsOf, type Traits } from "../data/traits";

export type Archetype = "dive" | "poke" | "protect" | "split" | "pick" | "teamfight";

export type WinCondition = { archetype: Archetype; names: string[] };

export const ARCHETYPE_NAMES: Record<Archetype, string> = {
  dive: "Dalış",
  poke: "Uzaktan yıpratma",
  protect: "Taşıyıcıyı koru",
  split: "Yan koridor baskısı",
  pick: "Tek hedef avı",
  teamfight: "Takım savaşı",
};

// Plain lines on how the team wants to play; {names} are the champions behind the archetype.
export const ARCHETYPE_PLANS: Record<Archetype, string[]> = {
  dive: [
    "Hedef: arka hattı tek hamlede kapatmak. {names} öne çıkar.",
    "Savaşı rakibin büyüleri beklemedeyken aç; uzun süre dışarıda kalma.",
  ],
  poke: [
    "Hedef: savaş başlamadan rakibin canını eritmek. {names} bunu yapar.",
    "Kuşatma ve obje beklemeleri sende; rakip dalarsa geri çekil, uzun savaşlar sana yarar.",
  ],
  protect: [
    "Hedef: arka hattın uzun süre hasar vermesi. {names} hasarı taşır.",
    "Koruyucuları taşıyıcıya yakın tut; savaşa girmeden önce rakibin dalışını bekle.",
  ],
  split: [
    "Hedef: bir koridoru tek başına itip rakibi dağıtmak. {names} yan koridora gider.",
    "Takım savaşı yerine harita baskısı kur; yan koridoru iten kişi savaşa zorlanmasın.",
  ],
  pick: [
    "Hedef: haritada yalnız kalanı yakalayıp sayı üstünlüğüyle objeyi almak. {names} avı yapar.",
    "Vizyon kur, rakibin yalnız yürüyen birini bul; 5'e 5 savaşı kendi şartlarınla aç.",
  ],
  teamfight: [
    "Hedef: toplu savaşta birden çok rakibe vurmak. {names} savaşı belirler.",
    "Birlikte dur, savaşı objeye yakın aç ve yeteneklerini üst üste kullan.",
  ],
};

function count(traits: Traits[], pick: (t: Traits) => boolean) {
  return traits.filter(pick).length;
}

/**
 * The two or three play styles this draft supports best, strongest first.
 * Needs three champions; a style needs at least two points to count.
 */
export function winConditions(team: Champion[], aram = false): WinCondition[] {
  if (team.length < 3) return [];
  const rows = team.map((c) => ({ name: c.name, t: traitsOf(c) }));
  const traits = rows.map((r) => r.t);
  const who = (pick: (t: Traits) => boolean) => rows.filter((r) => pick(r.t)).map((r) => r.name);
  const scores: Record<Archetype, number> = {
    dive: count(traits, (t) => t.engage && !t.poke) + count(traits, (t) => t.burst) * 0.5 - (count(traits, (t) => t.peel) >= 3 ? 1 : 0),
    poke: count(traits, (t) => t.poke) * (aram ? 2 : 1.5) - (count(traits, (t) => t.engage) >= 3 ? 1 : 0),
    protect: count(traits, (t) => t.backline) >= 2 ? Math.min(count(traits, (t) => t.backline), count(traits, (t) => t.peel) + count(traits, (t) => t.frontline)) : 0,
    split: aram ? 0 : count(traits, (t) => t.splitPush) * 2 - (count(traits, (t) => t.teamfight) >= 4 ? 1 : 0),
    pick: count(traits, (t) => t.pick) - 0.5,
    teamfight: count(traits, (t) => t.teamfight) - 1 + (count(traits, (t) => t.engage) >= 1 ? 0.5 : 0),
  };
  const members: Record<Archetype, (t: Traits) => boolean> = {
    dive: (t) => (t.engage && !t.poke) || t.burst,
    poke: (t) => t.poke,
    protect: (t) => t.backline || t.peel,
    split: (t) => t.splitPush,
    pick: (t) => t.pick,
    teamfight: (t) => t.teamfight,
  };
  return (Object.keys(scores) as Archetype[])
    .filter((a) => scores[a] >= 2)
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, 3)
    .map((archetype) => ({ archetype, names: who(members[archetype]) }));
}

/**
 * One line on how the team should play ARAM, where one narrow lane and no
 * way to hide make poke and sustain count for more than split pushing.
 */
export function aramPlan(team: Champion[]): { line: string; names: string[] } | null {
  if (team.length < 3) return null;
  const rows = team.map((c) => ({ name: c.name, t: traitsOf(c) }));
  const who = (pick: (t: Traits) => boolean) => rows.filter((r) => pick(r.t)).map((r) => r.name);
  const poke = who((t) => t.poke);
  const sustain = who((t) => t.healing || (t.peel && !t.frontline));
  const engage = who((t) => t.engage);
  if (poke.length >= 2 && sustain.length >= 1)
    return { line: "ARAM planı: {names} ile köprüde yıpratın, yaşayan taraf savaşı kazanır.", names: poke };
  if (poke.length >= 2) return { line: "ARAM planı: {names} ile köprüde yıpratın; kısa savaşlara girmeyin.", names: poke };
  if (sustain.length >= 2) return { line: "ARAM planı: {names} ile uzun savaşlara girin, canınızı koruyup rakibi eritin.", names: sustain };
  if (engage.length >= 2) return { line: "ARAM planı: {names} ile savaşı hızlı açın; rakip yıpratmadan önce iç içe girin.", names: engage };
  return { line: "ARAM planı: Net bir yıpratma ya da başlatma aracı yok; birlikte durun ve rakibin hatasını bekleyin.", names: [] };
}
