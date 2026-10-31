import type { Coaching, MatchSummary } from "./coach.ts";

// Free, deterministic coaching: each rule reads the match summary and, when it
// fires, returns a finding worded from the numbers it saw. Nothing here can
// state a fact the summary doesn't contain.

type Finding = { score: number; minute: number | null; title: string; detail: string };

const CS_TARGET: Record<string, number> = { TOP: 7, MIDDLE: 7, BOTTOM: 7, JUNGLE: 5.5 };
const VISION_TARGET: Record<string, number> = { UTILITY: 1.8, JUNGLE: 1.1 };
const DEFAULT_VISION_TARGET = 0.7;
const EARLY_GAME_MINUTES = 14;
// A death this soon before an enemy objective most likely gave it away.
const OBJECTIVE_WINDOW_MINUTES = 1.5;
const MAX_POINTS = 5;

const OBJECTIVE_NAMES: Record<string, string> = {
  DRAGON: "ejderhayı",
  BARON_NASHOR: "Baron'u",
  RIFTHERALD: "Vadi Alameti'ni",
  HORDE: "Boşluk Larvaları'nı",
  ATAKHAN: "Atakhan'ı",
  TOWER: "bir kuleyi",
};

const lower = (text: string) => text.toLocaleLowerCase("tr");
const minutesList = (minutes: number[]) => minutes.map((m) => `${Math.floor(m)}.`).join(", ");

function laneFindings(s: MatchSummary): Finding[] {
  const at10 = s.laneSnapshots.find((x) => x.minute === 10);
  const at15 = s.laneSnapshots.find((x) => x.minute === 15);
  const opponent = s.laneOpponent?.champion;
  if (!opponent || s.position === "UTILITY") return [];
  const found: Finding[] = [];

  if (at10?.goldDiff != null && at10.goldDiff <= -700) {
    const earlyDeaths = s.deaths.filter((d) => d.minute < 10).length;
    const cause =
      earlyDeaths >= 2
        ? `Bu farkın büyük kısmı ilk 10 dakikadaki ${earlyDeaths} ölümünden geliyor; erken güç anında geri çekilmek koridoru korur.`
        : at10.csDiff != null && at10.csDiff <= -15
          ? "Fark çoğunlukla minyon kaybından geliyor; dalgayı kendi kulene yakın tutup son vuruşlara odaklan."
          : "Rakibin güçlü olduğu seviyelerde takas yapmak yerine dalgayı kontrol etmeyi dene.";
    found.push({
      score: Math.abs(at10.goldDiff) / 100,
      minute: 10,
      title: "Koridorda erken geride kaldın",
      detail: `10. dakikada ${opponent} karşısında ${Math.abs(at10.goldDiff)} altın geriydin. ${cause}`,
    });
  }

  if (at15?.goldDiff != null && at15.goldDiff >= 1000) {
    const takenAfter = s.objectives.filter((o) => o.takenByUs && o.minute >= 15 && o.minute <= 25).length;
    found.push({
      score: takenAfter === 0 ? 6 : 2,
      minute: 15,
      title: "Koridoru kazandın",
      detail:
        takenAfter === 0
          ? `15. dakikada ${opponent} karşısında ${at15.goldDiff} altın öndeydin, ama sonraki 10 dakikada takım hiç hedef almadı. Öndeyken ormancınla ejderha ya da kule için hareket et.`
          : `15. dakikada ${opponent} karşısında ${at15.goldDiff} altın öndeydin ve takım bunu hedefe çevirdi. Bu oyun planını sürdür.`,
    });
  }
  return found;
}

function csFinding(s: MatchSummary): Finding[] {
  const target = CS_TARGET[s.position];
  const cs = s.player.csPerMinute;
  if (target === undefined || cs >= target - 1) return [];
  return [
    {
      score: (target - cs) * 4,
      minute: null,
      title: "Minyon toplaman düşük",
      detail: `Dakikada ${cs} minyon topladın; bu rolde ${target} ve üstü hedeflenir. Maçın ortasında boş kalan koridorlardaki dalgaları toplamak altın farkını kapatır.`,
    },
  ];
}

function deathFindings(s: MatchSummary): Finding[] {
  const found: Finding[] = [];
  const early = s.deaths.filter((d) => d.minute < EARLY_GAME_MINUTES);
  if (early.length >= 2) {
    const deep = early.filter((d) => d.where?.includes("rakip yarısı")).length;
    const ganked = early.filter((d) => d.killer !== s.laneOpponent?.champion && d.enemiesInvolved >= 2).length;
    const advice =
      deep > early.length / 2
        ? "Çoğu rakibin yarısında oldu; görüş olmadan ilerlemeden önce rakip ormancının nerede olduğunu düşün."
        : ganked > early.length / 2
          ? "Çoğunda koridor rakibin dışında biri de vardı; rakip ormancı görünmüyorsa dalgayı itme."
          : "Erken ölümler koridoru ve hedefleri birlikte kaybettirir; canın yarının altındayken üsse dön.";
    found.push({
      score: 6 + early.length * 2,
      minute: early[0].minute,
      title: "Erken oyunda çok öldün",
      detail: `İlk ${EARLY_GAME_MINUTES} dakikada ${early.length} kez öldün (${minutesList(early.map((d) => d.minute))} dakikalar). ${advice}`,
    });
  }

  const byKiller = new Map<string, number>();
  for (const d of s.deaths) byKiller.set(d.killer, (byKiller.get(d.killer) ?? 0) + 1);
  const [nemesis, times] = [...byKiller.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
  if (nemesis && times >= 3) {
    found.push({
      score: 3 + times,
      minute: null,
      title: `${nemesis} seni sık yakaladı`,
      detail: `${nemesis} seni ${times} kez öldürdü. Haritada nerede olduğunu bilmediğin anlarda ona karşı tek başına kalma.`,
    });
  }

  const outnumbered = s.deaths.filter((d) => d.enemiesInvolved >= 3);
  if (outnumbered.length >= 2) {
    found.push({
      score: 3 + outnumbered.length * 2,
      minute: outnumbered[0].minute,
      title: "Kalabalığa yakalandın",
      detail: `${outnumbered.length} ölümünde üç ya da daha fazla rakip vardı (${minutesList(outnumbered.map((d) => d.minute))} dakikalar). Rakiplerin çoğu haritada görünmüyorsa yalnız ilerleme.`,
    });
  }

  if (s.deaths.length >= 8 && early.length < 2) {
    found.push({
      score: s.deaths.length,
      minute: null,
      title: "Maç boyunca çok öldün",
      detail: `Toplam ${s.deaths.length} kez öldün. Her ölüm rakibe altın ve haritada süre verir; takım savaşına girmeden önce çıkış yolunu düşün.`,
    });
  }
  return found;
}

function objectiveFindings(s: MatchSummary): Finding[] {
  const found: Finding[] = [];
  const costly = s.deaths.flatMap((d) => {
    const lost = s.objectives.find(
      (o) => !o.takenByUs && o.minute >= d.minute && o.minute - d.minute <= OBJECTIVE_WINDOW_MINUTES,
    );
    return lost ? [{ death: d, lost }] : [];
  });
  if (costly.length > 0) {
    const first = costly[0];
    found.push({
      score: 5 + costly.length * 3,
      minute: first.death.minute,
      title: "Ölümlerin hedefe mal oldu",
      detail:
        `${Math.floor(first.death.minute)}. dakikadaki ölümünden kısa süre sonra rakip ${OBJECTIVE_NAMES[first.lost.what] ?? "bir hedefi"} aldı` +
        (costly.length > 1 ? `; maç boyunca bu ${costly.length} kez oldu.` : ".") +
        (first.lost.what === "TOWER"
          ? " Öldüğünde koridorun boş kalıyor; kule baskı altındayken riskli takasa girme."
          : " Büyük bir hedef canlanmadan önceki dakikada riskli takas yapma."),
    });
  }

  const dragons = s.objectives.filter((o) => o.what === "DRAGON");
  const ours = dragons.filter((o) => o.takenByUs).length;
  const theirs = dragons.length - ours;
  if (theirs - ours >= 2 && (s.position === "JUNGLE" || s.position === "BOTTOM" || s.position === "UTILITY")) {
    found.push({
      score: 4 + (theirs - ours),
      minute: null,
      title: "Ejderha kontrolü rakipteydi",
      detail: `Rakip ${theirs}, takımın ${ours} ejderha aldı. Ejderha canlanmadan önce alt bölgede görüş kurmak ve ormancınla aynı anda orada olmak bunu değiştirir.`,
    });
  }
  return found;
}

function visionFinding(s: MatchSummary): Finding[] {
  const target = VISION_TARGET[s.position] ?? DEFAULT_VISION_TARGET;
  const perMinute = Math.round((s.player.visionScore / s.durationMinutes) * 10) / 10;
  if (perMinute >= target) return [];
  const wardsKilled = s.player.wardsKilled ?? 0;
  return [
    {
      score: (target - perMinute) * 8,
      minute: null,
      title: "Görüş skorun düşük",
      detail:
        `Dakikada ${perMinute} görüş skoru topladın; bu rol için ${target} civarı beklenir. ${s.player.wardsPlaced ?? 0} totem koydun` +
        (wardsKilled === 0 ? " ve hiç totem kırmadın; her üsse dönüşte bir kontrol totemi al." : `, ${wardsKilled} totem kırdın.`),
    },
  ];
}

export function coachByRules(s: MatchSummary): Coaching {
  const findings = [
    ...laneFindings(s),
    ...csFinding(s),
    ...deathFindings(s),
    ...objectiveFindings(s),
    ...visionFinding(s),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_POINTS);

  const outcome = s.result === "win" ? "Kazandığın" : "Kaybettiğin";
  const headline =
    findings.length === 0
      ? `${outcome} bu maçta belirgin bir zayıf nokta görünmüyor; koridor, görüş ve ölüm sayın hedeflerin içinde.`
      : `${outcome} bu maçta en çok fark yaratacak konu: ${lower(findings[0].title)}.`;

  return {
    headline,
    points: findings.map(({ minute, title, detail }) => ({ minute: minute === null ? null : Math.floor(minute), title, detail })),
  };
}
