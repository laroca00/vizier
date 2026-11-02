import { useLang, useT } from "../i18n";
import { useEffect, useState } from "react";
import { getBans, getChampion, getCounters, getGameLog, type GameRow } from "../api";
import { CompAnalysis } from "../CompAnalysis";
import { EnemyTips } from "../ChampionGuide";
import { byChampion } from "../games";
import { JournalNote } from "../Journal";
import { championNoteKey, matchupNoteKey, usePersonal } from "../personal";
import { formatPercent } from "../i18n";
import {
  championIconUrl,
  champions,
  latestVersion,
  spellIconUrl,
  summonerSpells,
  type Champion,
  type SummonerSpell,
} from "../data/ddragon";
import { BuildSuggestion } from "../BuildSuggestion";
import { ProBuildList } from "../ProBuildList";
import { draftPhaseLabel, positionLabel } from "../labels";
import type { ChampSelect, DraftMember } from "../lcu";
import { LiquidGlass } from "../ui/LiquidGlass";
import { useSplash } from "../ui/Splash";
import { useAsync } from "../useAsync";

type StaticData = { version: string; champions: Map<number, Champion>; spells: Map<number, SummonerSpell> };

async function loadStatic(): Promise<StaticData> {
  const [version, championList, spells] = await Promise.all([latestVersion(), champions(), summonerSpells()]);
  return { version, champions: championList, spells };
}

function useSecondsLeft(endsAt: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

function shownChampion(member: DraftMember) {
  return member.championId || member.pickIntent;
}

export function ChampSelectPage({ draft, puuid = null }: { draft: ChampSelect; puuid?: string | null }) {
  const t = useT();
  const lang = useLang();
  const [data] = useAsync("static", loadStatic);
  const [bans] = useAsync("bans", getBans);
  // Enemy roles are hidden in ranked champ select, so the player names their lane opponent.
  const [opponent, setOpponent] = useState<number | null>(null);
  const enemyPicks = draft.theirTeam.map((m) => m.championId).filter((id) => id > 0);
  const vs = opponent !== null && enemyPicks.includes(opponent) ? opponent : null;
  const seconds = useSecondsLeft(draft.phaseEndsAt);
  const me = draft.myTeam.find((m) => m.isLocal);
  const ready = data.status === "done" ? data.value : null;
  useSplash(me ? shownChampion(me) : null);
  const [log] = useAsync(puuid ? `log:${puuid}` : null, () => getGameLog(puuid!));
  const games = log.status === "done" ? log.value : null;
  const allyIds = draft.myTeam.map(shownChampion).filter((id) => id > 0);

  return (
    <LiquidGlass className="panel draft" radius={28} strength={2.5} scroll>
      <header className="draft__header enter">
        <h1 className="draft__title">{t("Şampiyon seçimi")}</h1>
        <p className="draft__phase">
          {draftPhaseLabel(draft.phase, lang)}
          <span className="draft__timer" aria-label={t("{seconds} saniye kaldı", { seconds })}>
            {seconds}
          </span>
        </p>
      </header>

      <div className="draft__body">
        <section className="draft__me enter" aria-label={t("Senin seçimin")}>
          {me && <MyPick member={me} data={ready} />}
          {me && ready && shownChampion(me) > 0 && (
            <>
              <h2 className="draft__heading draft__heading--spaced">{t("Vizier önerisi")}</h2>
              <BuildSuggestion
                championId={shownChampion(me)}
                championName={ready.champions.get(shownChampion(me))?.name ?? ""}
                position={me.position || null}
                currentSpells={me.spells as [number, number]}
                locked={me.championId !== 0}
                vs={vs}
                enemies={enemyPicks}
              />
              <MyRecord championId={shownChampion(me)} games={games} />
              <DraftMatchups championId={shownChampion(me)} position={me.position} data={ready} />
              <JournalNote noteKey={championNoteKey(shownChampion(me))} label={t("{champion} notların", { champion: ready.champions.get(shownChampion(me))?.name ?? "" })} />
              {vs && (
                <JournalNote
                  noteKey={matchupNoteKey(shownChampion(me), vs)}
                  label={t("{opponent} eşleşmesi notların", { opponent: ready.champions.get(vs)?.name ?? "" })}
                  placeholder={t("Bu rakibe karşı ne işe yaradı?")}
                />
              )}
              <h2 className="draft__heading draft__heading--spaced">Pro'lar</h2>
              <ProBuildList
                filter={{ championId: shownChampion(me), position: me.position ? me.position.toUpperCase() : undefined, limit: 3 }}
                compact
                emptyText={t("Worlds oyuncularının bu şampiyonla son maçı yok.")}
              />
            </>
          )}
        </section>

        <section className="draft__teams enter" aria-label={t("Takımlar")}>
          <h2 className="draft__heading">{t("Takımın")}</h2>
          <ul className="team">
            {draft.myTeam.map((member) => (
              <TeamRow key={member.cellId} member={member} data={ready} />
            ))}
          </ul>

          <h2 className="draft__heading">{t("Rakip takım")}</h2>
          {enemyPicks.length === 0 ? (
            <p className="draft__empty">{t("Henüz seçim yok")}</p>
          ) : (
            <>
              <p className="draft__empty">{t("Koridor rakibini seç; öneri o eşleşmeye göre değişir.")}</p>
              <ul className="strip strip--pickable">
                {enemyPicks.map((id) => {
                  const champion = ready?.champions.get(id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        className="strip__pick"
                        aria-pressed={vs === id}
                        title={champion?.name}
                        onClick={() => setOpponent(vs === id ? null : id)}
                      >
                        {champion && ready && <img src={championIconUrl(ready.version, champion.id)} alt={champion.name} width={32} height={32} />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {ready && <CompAnalysis allies={allyIds} enemies={enemyPicks} champions={ready.champions} />}
          {ready && <EnemyTips enemies={enemyPicks.map((id) => ready.champions.get(id)).filter((c) => c !== undefined)} />}
          {ready && me && <PoolStrip position={me.position} games={games} data={ready} />}

          {draft.phase !== "FINALIZATION" && bans.status === "done" && bans.value.champions.length > 0 && (
            <>
              <h2 className="draft__heading">{t("Yasak önerisi")}</h2>
              <ChampionStrip ids={bans.value.champions.map((c) => c.championId).filter((id) => !draft.bans.includes(id))} data={ready} empty={t("Öneri yok")} />
            </>
          )}

          <h2 className="draft__heading">{t("Yasaklar")}</h2>
          <ChampionStrip ids={draft.bans} data={ready} empty={t("Yasak yok")} muted />
        </section>
      </div>
    </LiquidGlass>
  );
}

function MyPick({ member, data }: { member: DraftMember; data: StaticData | null }) {
  const t = useT();
  const lang = useLang();
  const championId = shownChampion(member);
  const champion = data?.champions.get(championId);
  const locked = member.championId !== 0;

  return (
    <div className="my-pick">
      <div className="my-pick__portrait" data-locked={locked}>
        {champion && data && <img src={championIconUrl(data.version, champion.id)} alt="" width={88} height={88} />}
      </div>
      <div>
        <p className="my-pick__name">{champion?.name ?? t("Şampiyon seçilmedi")}</p>
        <p className="my-pick__meta">
          {[positionLabel(member.position, lang), champion && !locked ? t("seçilmek üzere") : null].filter(Boolean).join(", ")}
        </p>
        {data && (
          <div className="my-pick__spells">
            {member.spells.map((key, i) => {
              const spell = data.spells.get(key);
              return spell ? (
                <img key={i} src={spellIconUrl(data.version, spell.id)} alt={spell.name} title={spell.name} width={28} height={28} />
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamRow({ member, data }: { member: DraftMember; data: StaticData | null }) {
  const t = useT();
  const lang = useLang();
  const champion = data?.champions.get(shownChampion(member));
  const locked = member.championId !== 0;
  return (
    <li data-local={member.isLocal || undefined} data-locked={locked || undefined}>
      <span className="team__position">{positionLabel(member.position, lang) ?? ""}</span>
      {champion && data ? (
        <img src={championIconUrl(data.version, champion.id)} alt="" width={28} height={28} className="team__icon" />
      ) : (
        <span className="team__icon team__icon--empty" />
      )}
      <span className="team__name">{champion?.name ?? t("Seçim bekleniyor")}</span>
      {member.isLocal ? <span className="team__you">{t("Sen")}</span> : champion && <AllyRate championId={champion.key} position={member.position} />}
    </li>
  );
}

function ChampionStrip({
  ids,
  data,
  empty,
  muted,
}: {
  ids: number[];
  data: StaticData | null;
  empty: string;
  muted?: boolean;
}) {
  const picked = ids.filter((id) => id > 0);
  if (picked.length === 0) return <p className="draft__empty">{empty}</p>;
  return (
    <ul className="strip" data-muted={muted || undefined}>
      {picked.map((id, i) => {
        const champion = data?.champions.get(id);
        return (
          <li key={`${id}-${i}`}>
            {champion && data && (
              <img src={championIconUrl(data.version, champion.id)} alt={champion.name} title={champion.name} width={32} height={32} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The champion's own win rate in that role across Emerald+ games. Teammates
 * are anonymous in ranked champ select, so this never looks at the player.
 */
function AllyRate({ championId, position }: { championId: number; position: string }) {
  const t = useT();
  const lang = useLang();
  const role = position ? position.toUpperCase() : null;
  const [state] = useAsync(`ally:${championId}:${role}`, () => getChampion(championId, role));
  if (state.status !== "done" || !state.value) return null;
  const { winRate, games, tier } = state.value;
  return (
    <span className="team__stat" title={t("{games} maç", { games })} data-thin={games < 100 || undefined}>
      {tier ? `${tier}, ` : ""}
      {formatPercent(winRate, lang, 1)}
    </span>
  );
}

function MyRecord({ championId, games }: { championId: number; games: GameRow[] | null }) {
  const t = useT();
  const lang = useLang();
  if (!games) return null;
  const line = byChampion(games).find((c) => c.championId === championId);
  return (
    <p className="build__summary draft__record">
      {line
        ? t("Son {total} dereceli maçında bu şampiyonla {games} maç, {rate} kazanma, {kda} KDA.", {
            total: games.length,
            games: line.games,
            rate: formatPercent(line.wins / line.games, lang),
            kda: line.kda.toFixed(1),
          })
        : t("Son {total} dereceli maçında bu şampiyonu oynamadın.", { total: games.length })}
    </p>
  );
}

const DRAFT_MATCHUPS = 3;

function DraftMatchups({ championId, position, data }: { championId: number; position: string; data: StaticData }) {
  const t = useT();
  const lang = useLang();
  const role = position ? position.toUpperCase() : null;
  const [state] = useAsync(role ? `counters:${championId}:${role}` : null, () => getCounters(championId, role!));
  if (state.status !== "done" || state.value.matchups.length < DRAFT_MATCHUPS * 2) return null;
  const all = state.value.matchups;
  const rows = [
    { title: "Zorlandığı rakipler", list: all.slice(0, DRAFT_MATCHUPS) },
    { title: "Rahat ettiği rakipler", list: all.slice(-DRAFT_MATCHUPS).reverse() },
  ];
  return (
    <div className="draft__matchups">
      {rows.map((row) => (
        <div key={row.title}>
          <h2 className="draft__heading">{t(row.title)}</h2>
          <ul className="strip">
            {row.list.map((m) => {
              const champion = data.champions.get(m.championId);
              return (
                <li key={m.championId} title={`${champion?.name ?? ""}, ${formatPercent(m.winRate, lang, 1)}, ${t("{games} maç", { games: m.games })}`}>
                  {champion && <img src={championIconUrl(data.version, champion.id)} alt={champion.name} width={32} height={32} />}
                  <span className="strip__rate">{formatPercent(m.winRate, lang)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PoolStrip({ position, games, data }: { position: string; games: GameRow[] | null; data: StaticData }) {
  const t = useT();
  const lang = useLang();
  const { pool } = usePersonal();
  const role = position ? position.toUpperCase() : null;
  const shown = pool.filter((p) => !p.position || !role || p.position === role);
  if (shown.length === 0) return null;
  const mine = games ? byChampion(games) : [];
  return (
    <>
      <h2 className="draft__heading">{t("Havuzun")}</h2>
      <ul className="strip">
        {shown.map((p) => {
          const champion = data.champions.get(p.championId);
          const line = mine.find((c) => c.championId === p.championId);
          return (
            <li key={p.championId} title={champion?.name}>
              {champion && <img src={championIconUrl(data.version, champion.id)} alt={champion.name} width={32} height={32} />}
              <span className="strip__rate">{line ? formatPercent(line.wins / line.games, lang) : "–"}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
