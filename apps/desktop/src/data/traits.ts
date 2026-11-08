import type { Champion } from "./ddragon";

// Vizier's own reading of what each champion brings to a team fight. Data
// Dragon only has classes and 0-10 ratings, so engage, poke, peel and power
// curve are hand-kept lists of Data Dragon ids. A champion missing from a
// list falls back to its classes.

const ENGAGE = new Set([
  "Alistar", "Amumu", "Leona", "Nautilus", "Rell", "Malphite", "Sejuani", "Zac", "Ornn", "Rakan", "JarvanIV",
  "MonkeyKing", "Vi", "Diana", "Maokai", "Rammus", "Skarner", "Kennen", "Galio", "Thresh", "Blitzcrank", "Pyke",
  "Sion", "Gragas", "Hecarim", "Nocturne", "Camille", "Kled", "Volibear", "Lissandra", "Annie", "Seraphine", "Nunu",
  "Shen", "KSante", "Gnar", "Fiddlesticks", "Briar", "Ambessa", "LeeSin", "XinZhao", "Yasuo", "Sett", "Warwick",
]);

const POKE = new Set([
  "Jayce", "Xerath", "Ziggs", "Varus", "Ezreal", "Lux", "Zoe", "Velkoz", "Nidalee", "Corki", "Caitlyn", "Jhin", "Hwei",
  "Mel", "Karma", "Viktor", "Senna", "Gangplank", "Syndra", "Heimerdinger", "Orianna", "Seraphine", "Zyra", "Teemo",
  "Aurora", "Smolder",
]);

const PEEL = new Set([
  "Janna", "Lulu", "Braum", "TahmKench", "Taric", "Karma", "Soraka", "Milio", "Renata", "Yuumi", "Thresh", "Nami",
  "Zilean", "Ivern", "Anivia", "Poppy", "Gragas", "Alistar", "Rakan", "Bard", "Morgana", "Sona", "Seraphine", "Shen",
  "Lissandra", "Maokai", "Galio", "Kayle", "Lux",
]);

const DISENGAGE = new Set([
  "Janna", "Gragas", "Poppy", "Anivia", "Trundle", "Braum", "TahmKench", "Lulu", "Zilean", "Renata", "Alistar",
  "Taliyah", "Gnar", "Azir", "Vayne", "Kalista", "Morgana", "Milio", "Nami", "Bard",
]);

const EARLY = new Set([
  "Renekton", "LeeSin", "Draven", "Pantheon", "Elise", "Lucian", "XinZhao", "RekSai", "Kalista", "Jayce", "Kled",
  "Olaf", "Nidalee", "Darius", "Taliyah", "Rengar", "Talon", "Qiyana", "Leblanc", "Shaco", "JarvanIV", "Udyr",
  "MissFortune", "Caitlyn", "Leona", "Blitzcrank", "Pyke", "Nautilus", "Sett", "Irelia", "Volibear", "Warwick",
  "Briar", "Naafiri", "Akshan", "Graves", "Rell",
]);

const LATE = new Set([
  "Kayle", "Kassadin", "Vayne", "Jax", "Veigar", "Nasus", "KogMaw", "Jinx", "Twitch", "Azir", "Ryze", "Smolder",
  "Senna", "Gangplank", "Ornn", "Aphelios", "Viktor", "Vladimir", "Cassiopeia", "MasterYi", "Tryndamere", "Gwen",
  "Chogath", "Zeri", "Kaisa", "AurelionSol", "Anivia", "Belveth", "Fiora", "Kindred", "Sona", "Yuumi", "Karthus",
  "Orianna", "Tristana", "Shyvana", "Nilah", "Swain", "Mordekaiser",
]);

// Can catch one target out of position and decide a fight before it starts.
const PICK = new Set([
  "Thresh", "Blitzcrank", "Nautilus", "Pyke", "Morgana", "Lux", "Ahri", "Leblanc", "Elise", "Zoe", "Rengar", "Evelynn",
  "Nidalee", "Ashe", "Varus", "Jhin", "Bard", "Leona", "TwistedFate", "Pantheon", "Talon", "Qiyana", "Zed", "Neeko",
  "Xerath", "Syndra", "Lissandra", "Kalista", "Zyra", "Rakan", "Renata", "Camille", "Vi", "LeeSin", "Nocturne", "Shaco",
  "Fiddlesticks", "Kayn", "Khazix", "Naafiri", "Akali", "Fizz", "Ezreal", "Caitlyn", "Senna", "Hwei", "Ambessa",
]);

// Ultimates or kits that hit several champions at once in a five-versus-five.
const TEAMFIGHT = new Set([
  "Malphite", "Amumu", "Orianna", "MissFortune", "Kennen", "Seraphine", "Sona", "Rumble", "Galio", "MonkeyKing",
  "Yasuo", "Yone", "JarvanIV", "Sejuani", "Annie", "Fiddlesticks", "Rell", "Neeko", "Diana", "Gragas", "Karthus", "Brand",
  "Zyra", "Leona", "Maokai", "Ornn", "Lillia", "Jinx", "Samira", "Cassiopeia", "Anivia", "Swain", "Vladimir", "Rakan",
  "Hwei", "Mel", "Zac", "Alistar", "Nami", "Taliyah", "Azir", "Ziggs", "Kayle", "Lissandra", "Aurora",
  "Gwen", "Kaisa", "Sett", "Nunu", "Ivern", "Zilean", "Karma", "Shen", "Sion", "Viktor", "Velkoz", "Lulu",
]);

// Heals or sustains enough that a grievous wounds item pays off against it.
const HEALING = new Set([
  "Soraka", "Aatrox", "Vladimir", "Warwick", "Sylas", "DrMundo", "Swain", "Fiora", "Yuumi", "Nami", "Sona", "Briar",
  "Seraphine", "Trundle", "Milio", "Samira", "Olaf", "Sett", "Illaoi", "Renekton", "Nasus", "Ivern", "Kayn", "Skarner",
]);

// Two or more hard crowd control effects (stun, root, suppress, knock-up, charm, fear) in one kit.
const HARD_CC = new Set([
  "Leona", "Nautilus", "Amumu", "Malphite", "Sejuani", "Alistar", "Blitzcrank", "Thresh", "Morgana", "Lissandra", "Rell",
  "Ornn", "Skarner", "Zac", "Vi", "JarvanIV", "Lux", "Ashe", "Syndra", "Maokai", "Sion", "Galio", "Fiddlesticks", "Annie",
  "Xerath", "Veigar", "Zyra", "Neeko", "Cassiopeia", "Warwick", "Pyke", "Rammus", "Bard", "Taric", "Braum", "Gragas",
  "Nunu", "Poppy", "Rakan", "Kled", "Ahri", "Elise", "Vex", "Janna", "Yone", "Hecarim", "Camille", "Lulu",
]);

// Kills a squishy target in a couple of seconds before it can answer.
const BURST = new Set([
  "Zed", "Talon", "Khazix", "Qiyana", "Akali", "Leblanc", "Fizz", "Evelynn", "Rengar", "Naafiri", "Katarina", "Shaco",
  "Ekko", "Veigar", "Annie", "Diana", "Nocturne", "Kayn", "Vex", "Syndra", "Pantheon", "Kassadin", "Samira", "Briar",
  "Ambessa", "Fiddlesticks", "Sylas", "Nidalee", "Elise", "Pyke",
]);

export type Phase = "early" | "mid" | "late";

export type Traits = {
  /** Share of the champion's damage that is magic, 0 to 1. */
  magic: number;
  tank: boolean;
  engage: boolean;
  poke: boolean;
  peel: boolean;
  disengage: boolean;
  phase: Phase;
  /** Stands in front and takes the damage: tanks and durable fighters. */
  frontline: boolean;
  /** Deals its damage from behind the frontline: marksmen and mages. */
  backline: boolean;
  pick: boolean;
  teamfight: boolean;
  healing: boolean;
  hardCc: boolean;
  burst: boolean;
};

export function traitsOf(c: Champion): Traits {
  const tagged = (tag: string) => c.tags.includes(tag);
  const sum = c.info.attack + c.info.magic;
  return {
    magic: sum > 0 ? c.info.magic / sum : 0.5,
    tank: c.tank || (tagged("Tank") && c.info.defense >= 7),
    engage: ENGAGE.has(c.id) || (c.tags[0] === "Tank" && !DISENGAGE.has(c.id)),
    poke: POKE.has(c.id),
    peel: PEEL.has(c.id) || (c.tags[0] === "Support" && !ENGAGE.has(c.id)),
    disengage: DISENGAGE.has(c.id),
    phase: EARLY.has(c.id) ? "early" : LATE.has(c.id) ? "late" : "mid",
    frontline: c.tank || tagged("Tank") || (c.tags[0] === "Fighter" && c.info.defense >= 5),
    backline: c.tags[0] === "Marksman" || (c.tags[0] === "Mage" && !tagged("Tank")),
    pick: PICK.has(c.id),
    teamfight: TEAMFIGHT.has(c.id),
    healing: HEALING.has(c.id),
    hardCc: HARD_CC.has(c.id),
    burst: BURST.has(c.id),
  };
}

export type Dimension = "frontline" | "backline" | "poke" | "pick" | "teamfight";

export const DIMENSIONS: Dimension[] = ["frontline", "backline", "poke", "pick", "teamfight"];

export const DIMENSION_NAMES: Record<Dimension, string> = {
  frontline: "Ön hat",
  backline: "Arka hat",
  poke: "Uzaktan yıpratma",
  pick: "Tek hedef yakalama",
  teamfight: "Takım savaşı",
};

// One line per dimension and level: none, one champion, two or more.
const DIMENSION_TEXT: Record<Dimension, [string, string, string]> = {
  frontline: [
    "Önde hasar karşılayacak kimse yok; savaşlar kısa ve riskli geçer.",
    "{names} önde tek başına; düşerse arka hat açıkta kalır.",
    "{names} önde hasarı karşılar; arka hat rahat vurur.",
  ],
  backline: [
    "Geriden sürekli hasar veren yok; hasar yakın mesafeden gelmek zorunda.",
    "Arkadan vuran tek isim {names}; onu korumak öncelik.",
    "{names} geriden hasar verir; uzun savaşlar bu takıma yarar.",
  ],
  poke: [
    "Uzaktan yıpratma yok; savaştan önce rakibin canını eksiltemez.",
    "{names} savaş öncesi rakibi yıpratabilir.",
    "{names} ile kuşatma ve obje beklemeleri bu takıma yarar.",
  ],
  pick: [
    "Tek kalan rakibi yakalayacak araç yok; savaşları toplu açmak zorunda.",
    "{names} haritada tek kalan rakibi yakalayabilir.",
    "{names} ile görüş kurup tek kalanları avlamak bu takımın planı.",
  ],
  teamfight: [
    "Toplu savaşta birden çok rakibe vuran yetenek yok; dağınık savaşlar bu takıma uyar.",
    "{names} toplu savaşta birkaç rakibe birden vurabilir.",
    "{names} ile 5'e 5 savaş bu takımın güçlü yanı.",
  ],
};

export type DimensionReport = { dimension: Dimension; names: string[]; level: 0 | 1 | 2 };

/** Frontline, backline, poke, pick and teamfight, each with who brings it. */
export function compDimensions(team: Champion[]): DimensionReport[] {
  return DIMENSIONS.map((dimension) => {
    const names = team.filter((c) => traitsOf(c)[dimension]).map((c) => c.name);
    return { dimension, names, level: Math.min(names.length, 2) as 0 | 1 | 2 };
  });
}

/** The template for the report; {names} is filled by the caller after translation. */
export function dimensionText(report: DimensionReport): string {
  return DIMENSION_TEXT[report.dimension][report.level];
}

export type Weakness = "noTank" | "noEngage" | "noPeel" | "allPhysical" | "allMagic";

export type CompReport = {
  champions: number;
  /** Magic share of the team's damage, 0 to 1. */
  magic: number;
  tanks: number;
  engage: number;
  poke: number;
  peel: number;
  disengage: number;
  /** When the team is at its strongest; null while too few champions are known. */
  phase: Phase | null;
  weaknesses: Weakness[];
};

export function analyzeComp(team: Champion[]): CompReport {
  const traits = team.map(traitsOf);
  const count = (pick: (t: Traits) => boolean) => traits.filter(pick).length;
  const magic = traits.length ? traits.reduce((sum, t) => sum + t.magic, 0) / traits.length : 0.5;
  const curve = traits.reduce((sum, t) => sum + (t.phase === "early" ? -1 : t.phase === "late" ? 1 : 0), 0);
  const report: CompReport = {
    champions: traits.length,
    magic,
    tanks: count((t) => t.tank),
    engage: count((t) => t.engage),
    poke: count((t) => t.poke),
    peel: count((t) => t.peel),
    disengage: count((t) => t.disengage),
    phase: traits.length < 3 ? null : curve <= -2 ? "early" : curve >= 2 ? "late" : "mid",
    weaknesses: [],
  };
  // Weaknesses only mean something once most of the team is picked.
  if (traits.length >= 4) {
    if (report.tanks === 0) report.weaknesses.push("noTank");
    if (report.engage === 0) report.weaknesses.push("noEngage");
    if (report.peel === 0) report.weaknesses.push("noPeel");
    if (magic < 0.25) report.weaknesses.push("allPhysical");
    if (magic > 0.75) report.weaknesses.push("allMagic");
  }
  return report;
}

export type Advice = { title: string; detail: string };

/**
 * General plans against the enemy draft, for champ select and the loading
 * screen. Nothing here reacts to the running game.
 */
export function adviceAgainst(enemy: CompReport, ours: CompReport): Advice[] {
  if (enemy.champions < 3) return [];
  const advice: Advice[] = [];
  if (enemy.engage >= 3)
    advice.push({
      title: "Rakip savaşı kendi başlatmak istiyor",
      detail: "Toplu dururken dalış yiyebilirsin. Kaçış büyülerini ilk dalışa sakla, savaşı geri çekilerek karşıla.",
    });
  if (enemy.poke >= 2)
    advice.push({
      title: "Rakip uzaktan yıpratıyor",
      detail: "Objeye canın eksikken gelme. Uzun kuşatmalar onlara yarar; savaşı hızlı aç ya da yan koridorlarda baskı kur.",
    });
  if (enemy.peel >= 2)
    advice.push({
      title: "Rakip taşıyıcısını iyi koruyor",
      detail: "Arka hatta düz dalış pahalı olur. Önce koruyucuların büyülerini harcat ya da taşıyıcıyı yan koridorda yakala.",
    });
  if (enemy.tanks >= 2)
    advice.push({
      title: "Rakipte iki ya da daha fazla tank var",
      detail: "Yüzde can hasarı ve zırh ya da büyü delme eşyaları bu maçta değer kazanır.",
    });
  if (enemy.magic >= 0.7)
    advice.push({ title: "Rakip hasarının çoğu büyü", detail: "Büyü direnci veren eşyalar ve rünler bu maçta daha çok işe yarar." });
  if (enemy.magic <= 0.3)
    advice.push({ title: "Rakip hasarının çoğu fiziksel", detail: "Zırh veren eşyalar ve rünler bu maçta daha çok işe yarar." });
  if (enemy.phase === "early" && ours.phase !== "early")
    advice.push({
      title: "Rakip erken oyunda güçlü",
      detail: "İlk 15 dakikada eşit olmayan savaşlardan kaçın ve minyon topla.",
    });
  if (enemy.phase === "late" && ours.phase !== "late")
    advice.push({
      title: "Rakip geç oyunda güçlü",
      detail: "Erken avantajı ejder ve kulelerle büyüt. Oyun uzadıkça denge rakibe kayar.",
    });
  return advice;
}

export const WEAKNESS_TEXT: Record<Weakness, string> = {
  noTank: "Tank yok; ön hat erken eriyebilir.",
  noEngage: "Savaşı başlatacak şampiyon yok.",
  noPeel: "Taşıyıcıyı koruyacak şampiyon yok.",
  allPhysical: "Hasarın neredeyse tamamı fiziksel; rakip tek tip zırhla karşılar.",
  allMagic: "Hasarın neredeyse tamamı büyü; rakip tek tip büyü direnciyle karşılar.",
};

export const PHASE_TEXT: Record<Phase, string> = { early: "Erken oyun", mid: "Orta oyun", late: "Geç oyun" };
