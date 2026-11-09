// How demanding a champion is in seven areas, as three levels. Hand-kept in
// Vizier's own judgement, not measured from games, so pages that show it
// mark it as editorial. Digits are 1 low, 2 medium, 3 high, in the order of
// DIFFICULTY_AREAS. "Consistency" means how much practice it takes to play
// the champion at the same level every game.

export const DIFFICULTY_AREAS = ["mechanics", "combos", "positioning", "skillshots", "decisions", "macro", "consistency"] as const;
export type DifficultyArea = (typeof DIFFICULTY_AREAS)[number];
export type DifficultyLevel = 1 | 2 | 3;

export const AREA_TEXT: Record<DifficultyArea, string> = {
  mechanics: "Mekanik",
  combos: "Kombolar",
  positioning: "Konumlanma",
  skillshots: "Yetenek isabeti",
  decisions: "Karar verme",
  macro: "Harita yönetimi",
  consistency: "İstikrar",
};

export const LEVEL_TEXT: Record<DifficultyLevel, string> = { 1: "Düşük", 2: "Orta", 3: "Yüksek" };

const TABLE: Record<string, string> = {
  Aatrox: "2223212", Ahri: "2222222", Akali: "3322233", Akshan: "2222232", Alistar: "2312222", Ambessa: "3321222",
  Amumu: "1213121", Anivia: "2223233", Annie: "1121111", Aphelios: "3333233", Ashe: "1132122", AurelionSol: "2223232",
  Aurora: "2332232", Azir: "3333333", Bard: "2223333", Belveth: "3332223", Blitzcrank: "1213212", Brand: "1223122",
  Braum: "1213222", Briar: "2321222", Caitlyn: "2133222", Camille: "3332233", Cassiopeia: "3333222", Chogath: "1212121",
  Corki: "2232222", Darius: "1211121", Diana: "2221222", Draven: "3333223", DrMundo: "1111121", Ekko: "2322233",
  Elise: "3333233", Evelynn: "2223332", Ezreal: "2232232", Fiddlesticks: "1223222", Fiora: "3333233", Fizz: "3322222",
  Galio: "2222223", Gangplank: "3333333", Garen: "1111111", Gnar: "2323222", Gragas: "2222222", Graves: "2232222",
  Gwen: "2321222", Hecarim: "2222222", Heimerdinger: "2223222", Hwei: "3333333", Illaoi: "1212222", Irelia: "3322233",
  Ivern: "1112332", Janna: "1132222", JarvanIV: "2322222", Jax: "2212222", Jayce: "3333232", Jhin: "2223222",
  Jinx: "2232222", Kaisa: "2222222", Kalista: "3333333", Karma: "1122222", Karthus: "2122322", Kassadin: "2212222", Kennen: "2222222",
  Katarina: "3333233", Kayle: "1122212", Kayn: "2322333", Khazix: "2322222", Kindred: "2222333", Kled: "2322222",
  KogMaw: "1133112", KSante: "3323223", Leblanc: "3332222", LeeSin: "3333333", Leona: "2312222", Lillia: "2222322",
  Lissandra: "2322222", Lucian: "2323222", Lulu: "1232222", Lux: "1123122", Malphite: "1211121", Malzahar: "1222122",
  Maokai: "1212222", MasterYi: "1112122", Mel: "2222222", Milio: "1222222", MissFortune: "1222122", MonkeyKing: "2222222",
  Mordekaiser: "1212122", Morgana: "1123222", Naafiri: "2221222", Nami: "2322222", Nasus: "1121222", Nautilus: "1213122",
  Neeko: "2322222", Nidalee: "3333333", Nilah: "2223222", Nocturne: "1112222", Nunu: "1212232", Olaf: "1211122",
  Orianna: "2332222", Ornn: "1212222", Pantheon: "2222222", Poppy: "1212222", Pyke: "3322333", Qiyana: "3332222",
  Quinn: "2222222", Rakan: "3322222", Rammus: "1111121", RekSai: "2222222", Rell: "2322222", Renata: "2222332",
  Renekton: "2222222", Rengar: "3321222", Riven: "3333233", Rumble: "2332222", Ryze: "3333222", Samira: "3333233",
  Sejuani: "1212222", Senna: "2133222", Seraphine: "1222222", Sett: "1212222", Shaco: "3223333", Shen: "1213232",
  Shyvana: "1212222", Singed: "2223323", Sion: "1211122", Sivir: "1122122", Skarner: "1212222", Smolder: "1122122",
  Sona: "1223222", Soraka: "1122222", Swain: "2222222", Sylas: "3322232", Syndra: "2332222", TahmKench: "2222223",
  Taliyah: "2233222", Talon: "2322222", Taric: "2312222", Teemo: "1122122", Thresh: "3333333", Tristana: "2222122",
  Trundle: "1111222", Tryndamere: "2122122", TwistedFate: "2222323", Twitch: "1223122", Udyr: "1111222", Urgot: "2222222",
  Varus: "2232222", Vayne: "3333222", Veigar: "1122222", Velkoz: "2232222", Vex: "2222222", Vi: "1212122",
  Viego: "3322333", Viktor: "2322222", Vladimir: "2222222", Volibear: "1212222", Warwick: "1112122", Xayah: "2223222",
  Xerath: "1133222", XinZhao: "1211222", Yasuo: "3333233", Yone: "3322233", Yorick: "2222223", Yunara: "2222222",
  Yuumi: "1123223", Zac: "2322222", Zed: "3322233", Zeri: "3332233", Ziggs: "1233122", Zilean: "2222222",
  Zoe: "2232222", Zyra: "1223122",
};

export type DifficultyBreakdown = Record<DifficultyArea, DifficultyLevel>;

/** The hand-kept breakdown of a champion (Data Dragon id), or null for one not written up. */
export function difficultyBreakdownOf(championId: string): DifficultyBreakdown | null {
  const code = TABLE[championId];
  if (!code || code.length !== DIFFICULTY_AREAS.length) return null;
  const result = {} as DifficultyBreakdown;
  for (const [i, area] of DIFFICULTY_AREAS.entries()) result[area] = Number(code[i]) as DifficultyLevel;
  return result;
}

export const DIFFICULTY_BREAKDOWN_IDS = Object.keys(TABLE);
