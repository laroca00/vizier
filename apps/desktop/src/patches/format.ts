import type { Lang } from "../i18n";
import type { Change } from "./diff";

// Words for the codes a patch diff uses, shared by the patch tracker and Home.

const STAT_NAMES: Record<string, string> = {
  hp: "Can",
  hpperlevel: "Seviye başına can",
  mp: "Kaynak",
  mpperlevel: "Seviye başına kaynak",
  movespeed: "Hareket hızı",
  armor: "Zırh",
  armorperlevel: "Seviye başına zırh",
  spellblock: "Büyü direnci",
  spellblockperlevel: "Seviye başına büyü direnci",
  attackrange: "Saldırı menzili",
  hpregen: "Can yenilenmesi",
  hpregenperlevel: "Seviye başına can yenilenmesi",
  mpregen: "Kaynak yenilenmesi",
  mpregenperlevel: "Seviye başına kaynak yenilenmesi",
  crit: "Kritik vuruş",
  critperlevel: "Seviye başına kritik vuruş",
  attackdamage: "Saldırı gücü",
  attackdamageperlevel: "Seviye başına saldırı gücü",
  attackspeed: "Saldırı hızı",
  attackspeedperlevel: "Seviye başına saldırı hızı",
};

const ITEM_STATS: Record<string, string> = {
  FlatHPPoolMod: "Can",
  FlatMPPoolMod: "Mana",
  FlatArmorMod: "Zırh",
  FlatSpellBlockMod: "Büyü direnci",
  FlatPhysicalDamageMod: "Saldırı gücü",
  FlatMagicDamageMod: "Yetenek gücü",
  PercentAttackSpeedMod: "Saldırı hızı",
  FlatCritChanceMod: "Kritik vuruş şansı",
  FlatMovementSpeedMod: "Hareket hızı",
  PercentMovementSpeedMod: "Hareket hızı",
  PercentLifeStealMod: "Can çalma",
  FlatHPRegenMod: "Can yenilenmesi",
};

const SPELL_FIELDS: Record<string, string> = { cooldown: "{key} bekleme süresi", cost: "{key} bedeli", range: "{key} menzili" };

export type T = (text: string, params?: Record<string, string | number>) => string;

/** Stats that grow per level; their base value is the level 1 value. */
const GROWING = new Set(["hp", "attackdamage", "armor", "spellblock", "attackspeed"]);

export function fieldLabel(field: string, t: T) {
  const [kind, a, b] = field.split(":");
  if (kind === "level") return t("{stat} (18. seviye)", { stat: t(STAT_NAMES[a] ?? a) });
  if (kind === "stat" && GROWING.has(a)) return t("{stat} (1. seviye)", { stat: t(STAT_NAMES[a] ?? a) });
  if (kind === "stat") return t(STAT_NAMES[a] ?? a);
  if (kind === "spell") return t(SPELL_FIELDS[b] ?? b, { key: a });
  if (field === "item:gold") return t("Fiyat");
  if (field === "item:recipe") return t("Tarif");
  if (kind === "item" && a === "stat") return t(ITEM_STATS[b] ?? b);
  return field;
}

export function formatValue(change: Change, value: Change["before"], itemNames: Record<string, string>, lang: Lang, t: T) {
  if (value === null) return t("yok");
  if (change.field === "item:recipe") return String(value).split("+").map((id) => itemNames[id] ?? id).join(" + ");
  const stat = change.field.split(":").pop() ?? "";
  if (typeof value === "number" && (stat.startsWith("Percent") || stat === "FlatCritChanceMod")) {
    return `${Math.round(value * 1000) / 10}%`;
  }
  return typeof value === "number" ? value.toLocaleString(lang === "tr" ? "tr" : "en-GB") : value;
}
