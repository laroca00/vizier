import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

// Post-game coaching: the match and its timeline are boiled down to a small
// summary first, so the model sees only facts from the game and a request
// stays a few thousand tokens.

const MODEL = "claude-opus-5-5";
const SNAPSHOT_MINUTES = [5, 10, 15, 20];

export type CoachParticipant = {
  puuid: string;
  participantId: number;
  teamId: number;
  championName: string;
  teamPosition: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
};

export type CoachMatch = {
  metadata: { matchId: string };
  info: { gameDuration: number; queueId: number; participants: CoachParticipant[] };
};

type Frame = {
  timestamp: number;
  participantFrames: Record<string, { totalGold: number; xp: number; minionsKilled: number; jungleMinionsKilled: number; level: number }>;
  events: {
    type: string;
    timestamp: number;
    killerId?: number;
    victimId?: number;
    assistingParticipantIds?: number[];
    position?: { x: number; y: number };
    monsterType?: string;
    buildingType?: string;
    killerTeamId?: number;
    teamId?: number;
  }[];
};

export type Timeline = { info: { frames: Frame[] } };

const minute = (ms: number) => Math.round(ms / 6000) / 10;

/** Blue base is bottom left (0,0), red top right (~15000,15000). */
function zone({ x, y }: { x: number; y: number }, teamId: number): string {
  const diagonal = y - x;
  const river = Math.abs(x + y - 15000) < 1800;
  const ownSide = teamId === 100 ? x + y < 15000 : x + y > 15000;
  const lane = diagonal > 4500 ? "üst koridor" : diagonal < -4500 ? "alt koridor" : "orta bölge";
  return `${lane}, ${river ? "nehir" : ownSide ? "kendi yarısı" : "rakip yarısı"}`;
}

export function summarize(match: CoachMatch, timeline: Timeline, puuid: string) {
  const me = match.info.participants.find((p) => p.puuid === puuid);
  if (!me) return null;
  const opponent = match.info.participants.find((p) => p.teamId !== me.teamId && p.teamPosition === me.teamPosition);
  const byId = new Map(match.info.participants.map((p) => [p.participantId, p]));
  const minutes = match.info.gameDuration / 60;

  const line = (p: CoachParticipant) => ({
    champion: p.championName,
    kda: `${p.kills}/${p.deaths}/${p.assists}`,
    csPerMinute: Math.round(((p.totalMinionsKilled + p.neutralMinionsKilled) / minutes) * 10) / 10,
    gold: p.goldEarned,
    damageToChampions: p.totalDamageDealtToChampions,
    visionScore: p.visionScore,
  });

  const frames = timeline.info.frames;
  const snapshots = SNAPSHOT_MINUTES.filter((m) => frames[m]).map((m) => {
    const mine = frames[m].participantFrames[String(me.participantId)];
    const theirs = opponent ? frames[m].participantFrames[String(opponent.participantId)] : undefined;
    return {
      minute: m,
      cs: mine.minionsKilled + mine.jungleMinionsKilled,
      goldDiff: theirs ? mine.totalGold - theirs.totalGold : null,
      xpDiff: theirs ? mine.xp - theirs.xp : null,
      csDiff: theirs ? mine.minionsKilled + mine.jungleMinionsKilled - theirs.minionsKilled - theirs.jungleMinionsKilled : null,
    };
  });

  const events = frames.flatMap((f) => f.events);
  const deaths = events
    .filter((e) => e.type === "CHAMPION_KILL" && e.victimId === me.participantId)
    .map((e) => ({
      minute: minute(e.timestamp),
      killer: byId.get(e.killerId ?? 0)?.championName ?? "minyon veya kule",
      enemiesInvolved: 1 + (e.assistingParticipantIds?.length ?? 0),
      where: e.position ? zone(e.position, me.teamId) : null,
    }));
  const objectives = events
    .filter((e) => e.type === "ELITE_MONSTER_KILL" || (e.type === "BUILDING_KILL" && e.buildingType === "TOWER_BUILDING"))
    .map((e) => {
      // Monster kills name the killing team; building kills name the team that lost the tower.
      const takenByUs = e.type === "ELITE_MONSTER_KILL" ? e.killerTeamId === me.teamId : e.teamId !== me.teamId;
      return { minute: minute(e.timestamp), what: e.monsterType ?? "TOWER", takenByUs };
    });

  return {
    durationMinutes: Math.round(minutes),
    result: me.win ? "win" : "loss",
    position: me.teamPosition,
    player: { ...line(me), wardsPlaced: me.wardsPlaced, wardsKilled: me.wardsKilled },
    laneOpponent: opponent ? line(opponent) : null,
    laneSnapshots: snapshots,
    deaths,
    objectives,
  };
}

export type MatchSummary = NonNullable<ReturnType<typeof summarize>>;

const CoachingSchema = z.object({
  headline: z.string(),
  points: z.array(
    z.object({
      minute: z.number().nullable(),
      title: z.string(),
      detail: z.string(),
    }),
  ),
});

export type Coaching = z.infer<typeof CoachingSchema>;

const SYSTEM = `Bir League of Legends koçusun. Türkiye sunucusunda dereceli oynayan bir oyuncuya maç sonrası geri bildirim veriyorsun.

Sana tek bir maçın özet verisi gelecek. Yalnızca bu veriye dayan; veride olmayan bir olayı, eşyayı ya da kararı uydurma. Bir şeyi veriden çıkaramıyorsan söyleme.

Türkçe yaz, oyuncuya "sen" diye hitap et. headline: maçın tek cümlelik değerlendirmesi. points: oyuncunun bir sonraki maçta uygulayabileceği 3 ila 5 somut nokta, en çok fark yaratacak olan önce. Her noktada ilgili dakikayı minute alanına yaz, dakika yoksa null bırak. title kısa olsun; detail iki üç cümlede neyin olduğunu ve neyi farklı yapacağını anlatsın. Abartılı övgü, genel tavsiye ve dolgu cümlesi kullanma.

Koordinatlar ve bölge adları yaklaşıktır. goldDiff, xpDiff ve csDiff koridor rakibine göre farktır; pozitif değer oyuncunun önde olduğunu gösterir.`;

export async function coach(client: Anthropic, summary: MatchSummary): Promise<Coaching> {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: betaZodOutputFormat(CoachingSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(summary) }],
  });
  if (response.stop_reason === "refusal") throw new Error("coach request was declined");
  if (!response.parsed_output) throw new Error(`coach response did not parse (stop: ${response.stop_reason})`);
  return response.parsed_output;
}
