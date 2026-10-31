import type { Platform } from "./riot/client.ts";

export type ProGroup = "worlds" | "turkey";

export type ProPlayer = {
  name: string;
  /** Empty when the player has no team right now. */
  team: string;
  /** match-v5 teamPosition of their usual role. */
  role: "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY";
  accounts: { riotId: string; platform: Platform }[];
  /** Worlds unless set. */
  group?: ProGroup;
};

// Worlds 2026: the four LCK teams, and BrokenBlade (G2) as the Turkish player
// at the event. Accounts as listed on trackingthepros.com on 2026-10-31.
// Players switch accounts often; check the source before each event.
const WORLDS_PLAYERS: ProPlayer[] = [
  { name: "Kiin", team: "Gen.G", role: "TOP", accounts: [{ riotId: "kiin#KR1", platform: "kr" }, { riotId: "asdzxcvqwe#123", platform: "na1" }] },
  {
    name: "Canyon",
    team: "Gen.G",
    role: "JUNGLE",
    accounts: [
      { riotId: "JUGKlNG#kr", platform: "kr" },
      { riotId: "HUANG TONG DAYE#KR1", platform: "kr" },
      { riotId: "Concrete jungle#USA", platform: "na1" },
    ],
  },
  {
    name: "Chovy",
    team: "Gen.G",
    role: "MIDDLE",
    accounts: [
      { riotId: "calm down#can", platform: "na1" },
      { riotId: "허거덩#0303", platform: "kr" },
    ],
  },
  {
    name: "Ruler",
    team: "Gen.G",
    role: "BOTTOM",
    accounts: [
      { riotId: "황금고블린1#KR1", platform: "kr" },
      { riotId: "강 철#샤 넬", platform: "kr" },
      { riotId: "proteinmonster#thief", platform: "na1" },
    ],
  },
  { name: "Duro", team: "Gen.G", role: "UTILITY", accounts: [{ riotId: "Duro#Gen", platform: "kr" }, { riotId: "New York#1114", platform: "na1" }] },

  { name: "Zeus", team: "Hanwha Life Esports", role: "TOP", accounts: [{ riotId: "Athene#lll", platform: "kr" }, { riotId: "Austin#lll", platform: "na1" }] },
  {
    name: "Kanavi",
    team: "Hanwha Life Esports",
    role: "JUNGLE",
    accounts: [
      { riotId: "Black#294", platform: "kr" },
      { riotId: "Lillie#397", platform: "na1" },
    ],
  },
  {
    name: "Zeka",
    team: "Hanwha Life Esports",
    role: "MIDDLE",
    accounts: [
      { riotId: "suis#kr7", platform: "kr" },
      { riotId: "DAZBEEE#777", platform: "na1" },
    ],
  },
  {
    name: "Gumayusi",
    team: "Hanwha Life Esports",
    role: "BOTTOM",
    accounts: [
      { riotId: "HLE Gumayusi#0298", platform: "kr" },
      { riotId: "Know my name#9999", platform: "na1" },
    ],
  },
  {
    name: "Delight",
    team: "Hanwha Life Esports",
    role: "UTILITY",
    accounts: [
      { riotId: "플레이리스트겨울#KR1", platform: "kr" },
      { riotId: "2026sup1#111", platform: "na1" },
    ],
  },

  { name: "Doran", team: "T1", role: "TOP", accounts: [{ riotId: "어리고싶다#KR1", platform: "kr" }, { riotId: "buriburii#1234", platform: "na1" }] },
  { name: "Oner", team: "T1", role: "JUNGLE", accounts: [{ riotId: "오 너#111", platform: "kr" }, { riotId: "worlds#111", platform: "na1" }] },
  { name: "Faker", team: "T1", role: "MIDDLE", accounts: [{ riotId: "Hide on bush#KR1", platform: "kr" }, { riotId: "Hide in bush#NYKR", platform: "na1" }] },
  { name: "Peyz", team: "T1", role: "BOTTOM", accounts: [{ riotId: "Peyz#KR11", platform: "kr" }, { riotId: "gaesalbuger#aaaa", platform: "na1" }] },
  { name: "Keria", team: "T1", role: "UTILITY", accounts: [{ riotId: "Ciro#KR10", platform: "kr" }, { riotId: "doryunnim#Frank", platform: "na1" }] },

  {
    name: "Siwoo",
    team: "Dplus KIA",
    role: "TOP",
    accounts: [
      { riotId: "Siuuuuuuuuuuuuuu#yarrr", platform: "na1" },
      { riotId: "TOPKING#asd", platform: "kr" },
    ],
  },
  { name: "Lucid", team: "Dplus KIA", role: "JUNGLE", accounts: [{ riotId: "DK Lucid#KR1", platform: "kr" }, { riotId: "tyjoierg#123", platform: "na1" }] },
  {
    name: "ShowMaker",
    team: "Dplus KIA",
    role: "MIDDLE",
    accounts: [
      { riotId: "DK ShowMaker#KR1", platform: "kr" },
      { riotId: "MIDKING#asd", platform: "kr" },
      { riotId: "Sonny Hayes#722", platform: "na1" },
    ],
  },
  { name: "Smash", team: "Dplus KIA", role: "BOTTOM", accounts: [{ riotId: "DK Smash#KR7", platform: "kr" }, { riotId: "123321#KR12", platform: "na1" }] },
  { name: "Career", team: "Dplus KIA", role: "UTILITY", accounts: [{ riotId: "팽도리#1015", platform: "kr" }, { riotId: "하이용#1015", platform: "na1" }] },

  {
    name: "BrokenBlade",
    team: "G2 Esports",
    role: "TOP",
    accounts: [
      { riotId: "BrokenBlade#12345", platform: "na1" },
      { riotId: "G2 BrokenBlade#1918", platform: "na1" },
      { riotId: "G2 BrokenBlade#1918", platform: "euw1" },
    ],
  },
];

// Turkish players, current and former TCL, wherever they play now. Accounts
// as listed on lolpros.gg and trackingthepros.com on 2026-10-31; only those
// shown with a server are kept.
const TURKISH_PLAYERS: ProPlayer[] = [
  {
    name: "Armut",
    team: "",
    role: "TOP",
    accounts: [
      { riotId: "Pompaci Armut#123", platform: "euw1" },
      { riotId: "TR STAGE BEAST#EUW", platform: "euw1" },
      { riotId: "ARMUTONG#EUW", platform: "euw1" },
    ],
  },
  { name: "113", team: "Misa Esports", role: "JUNGLE", accounts: [{ riotId: "can win#monk", platform: "euw1" }] },
  {
    name: "Rhilech",
    team: "Natus Vincere",
    role: "JUNGLE",
    accounts: [
      { riotId: "Rhilech#15105", platform: "euw1" },
      { riotId: "Shiba lnui#EUW", platform: "euw1" },
      { riotId: "151005#EUW", platform: "euw1" },
    ],
  },
  {
    name: "Naak Nako",
    team: "Team Vitality",
    role: "TOP",
    accounts: [
      { riotId: "VIT NaakNako#TOP", platform: "na1" },
      { riotId: "E Q D E Q A R#EUW", platform: "euw1" },
    ],
  },
  { name: "Elwind", team: "", role: "TOP", accounts: [{ riotId: "Elwind#EUW", platform: "euw1" }, { riotId: "95Jh2D7R95SKDONY#EUW", platform: "euw1" }] },
  { name: "Closer", team: "", role: "JUNGLE", accounts: [{ riotId: "Closer#kral", platform: "na1" }] },
  {
    name: "Ferret",
    team: "Partizan Sangal",
    role: "JUNGLE",
    accounts: [
      { riotId: "Psychoferret#71300", platform: "euw1" },
      { riotId: "ßE HUMBLE#EUW", platform: "euw1" },
    ],
  },
  { name: "Robin", team: "", role: "JUNGLE", accounts: [{ riotId: "beri hibiskus#EUW", platform: "euw1" }] },
  {
    name: "Mojito",
    team: "",
    role: "JUNGLE",
    accounts: [
      { riotId: "Mojito#QWE", platform: "na1" },
      { riotId: "Shin Jin Young#EUW", platform: "euw1" },
    ],
  },
  { name: "StarScreen", team: "Pyramid IV Esports", role: "TOP", accounts: [{ riotId: "StarScreen#1702", platform: "euw1" }] },
  { name: "fabFabulous", team: "Dark Passage", role: "TOP", accounts: [{ riotId: "FABFABFAB#EUW", platform: "euw1" }, { riotId: "nuD6lhwuEMqymodp#EUW", platform: "euw1" }] },
  { name: "Zeitnot", team: "", role: "BOTTOM", accounts: [{ riotId: "zeitnot#7149", platform: "euw1" }, { riotId: "I8RTSdenbYAa7axs#EUW", platform: "euw1" }] },
  { name: "Padden", team: "", role: "BOTTOM", accounts: [{ riotId: "FB paddyN#EUW", platform: "euw1" }] },
  { name: "Kaori", team: "", role: "BOTTOM", accounts: [{ riotId: "Kaori#EUW33", platform: "euw1" }] },
  { name: "HolyPhoenix", team: "", role: "BOTTOM", accounts: [{ riotId: "BW HolyPhoenix#PHX", platform: "euw1" }] },
  { name: "Zergsting", team: "", role: "UTILITY", accounts: [{ riotId: "Zergsting#EUW", platform: "euw1" }, { riotId: "Son of Frozen#EUW", platform: "euw1" }] },
  {
    name: "Tolerant",
    team: "",
    role: "UTILITY",
    accounts: [
      { riotId: "Sukuna#361", platform: "euw1" },
      { riotId: "GeneraIIeutnant#EUW", platform: "euw1" },
      { riotId: "gap support#EUW", platform: "euw1" },
    ],
  },
  { name: "Japone", team: "Misa Esports", role: "UTILITY", accounts: [{ riotId: "InsaneMentality#EUW", platform: "euw1" }, { riotId: "DP Japone#EUW", platform: "euw1" }] },
];

export const PRO_PLAYERS: ProPlayer[] = [...WORLDS_PLAYERS, ...TURKISH_PLAYERS.map((p) => ({ ...p, group: "turkey" as const }))];
