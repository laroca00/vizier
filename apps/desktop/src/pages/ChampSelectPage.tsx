import { useEffect, useState } from "react";
import { getChampion, getCounters, getSynergies } from "../api";
import { BuildSuggestion } from "../BuildSuggestion";
import { EnemyTips } from "../ChampionGuide";
import { CompAnalysis } from "../CompAnalysis";
import {
  championIconUrl,
  champions,
  latestVersion,
  spellIconUrl,
  summonerSpells,
  type Champion,
  type SummonerSpell,
} from "../data/ddragon";
import { checkRole } from "../draft/allyRole";
import { ArenaItems } from "../draft/ArenaItems";
import { ArenaDuo } from "../draft/ArenaDuo";
import { isArena } from "../draft/arena";
import { BenchHelper } from "../draft/BenchHelper";
import { HoverMatchup } from "../draft/HoverMatchup";
import { ChampionAugments } from "../augments/ChampionAugments";
import { BanPlanner } from "../draft/BanPlannerPanel";
import { autoView, draftQueue, duoPartnerRole, hasBench, shownChampion, type DraftView } from "../draft/logic";
import { MatchupGuide } from "../draft/MatchupGuide";
import { PickSuggestions } from "../draft/PickSuggestions";
import { ThreatsPanel } from "../draft/ThreatsPanel";
import { ItemAdvicePanel } from "../draft/ItemAdvicePanel";
import { PoolBuild } from "../draft/PoolBuild";
import { useOpponent, type Opponent } from "../draft/useOpponent";
import { formatPercent, useLang, useT } from "../i18n";
import { JournalNote, NotePreview, useMatchupTemplate } from "../Journal";
import { draftPhaseLabel, positionLabel } from "../labels";
import type { ChampSelect, DraftMember } from "../lcu";
import { MatchupLink } from "../matchupLink";
import { championNoteKey, matchupNoteKey, usePersonal } from "../personal";
import { MAYHEM } from "../queues";
import { LiquidGlass } from "../ui/LiquidGlass";
import { useSplash } from "../ui/Splash";
import { Tabs } from "../ui/Tabs";
import { useAsync } from "../useAsync";
import "./ChampSelectPage.css";
// After the page's base styles, which it adjusts.
import "../draft/draft.css";

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

export function ChampSelectPage({ draft }: { draft: ChampSelect }) {
  const t = useT();
  const matchupTemplate = useMatchupTemplate();
  const lang = useLang();
  const [data] = useAsync("static", loadStatic);
  const { pool } = usePersonal();
  const seconds = useSecondsLeft(draft.phaseEndsAt);
  const me = draft.myTeam.find((m) => m.isLocal);
  const ready = data.status === "done" ? data.value : null;
  const myChampion = me ? shownChampion(me) : 0;
  const locked = !!me && me.championId !== 0;
  const queue = draftQueue(draft);
  const role = me?.position ? me.position.toUpperCase() : null;
  useSplash(myChampion || null);

  // The view follows the draft; a tab the player picks holds until the next turn.
  const auto = autoView(draft);
  const [manual, setManual] = useState<{ view: DraftView; moment: string } | null>(null);
  const view = manual && manual.moment === auto.moment ? manual.view : auto.view;

  // Enemy roles are hidden in ranked, so Vizier guesses the lane opponent and the player can correct it.
  const enemyPicks = draft.theirTeam.map((m) => m.championId).filter((id) => id > 0);
  const [chosenOpponent, setChosenOpponent] = useState<number | null>(null);
  const opponent = useOpponent(enemyPicks, role, chosenOpponent);
  const vs = opponent?.championId ?? null;

  const allyIds = draft.myTeam.map(shownChampion).filter((id) => id > 0);
  const allies = ready
    ? draft.myTeam
        .filter((m) => !m.isLocal)
        .map((m) => ready.champions.get(shownChampion(m)))
        .filter((c): c is Champion => c !== undefined)
    : [];
  const unavailable = new Set([...draft.bans, ...draft.myTeam.filter((m) => !m.isLocal).map((m) => m.championId), ...enemyPicks]);

  // The hovered or locked champion; before that, the pool main for the role.
  const banSubject = myChampion || pool.find((p) => p.rank === "main" && (!p.position || !role || p.position === role))?.championId || null;
  const banAllies = draft.myTeam
    .filter((m) => !m.isLocal && shownChampion(m) > 0 && m.position)
    .map((m) => ({ championId: shownChampion(m), position: m.position.toUpperCase() }));

  // In Arena the partner's champion decides what pairs well; before it is chosen, the player's own does.
  const partnerMember = isArena(draft) ? draft.myTeam.find((m) => !m.isLocal) : undefined;
  const arenaPartner = partnerMember ? shownChampion(partnerMember) : 0;
  const arenaAnchor = isArena(draft) ? arenaPartner || myChampion : 0;

  function chooseOpponent(id: number) {
    // Pressing the current choice again hands the lane back to the guess.
    setChosenOpponent(opponent && !opponent.guessed && opponent.championId === id ? null : id);
  }

  return (
    <LiquidGlass className="panel draft" radius={28} strength={2.5} scroll>
      <header className="draft__header enter">
        <h1 className="draft__title">{t("Şampiyon seçimi")}</h1>
        <Tabs
          items={[
            { id: "draft" as DraftView, label: t("Draft") },
            { id: "build" as DraftView, label: t("Build") },
          ]}
          value={view}
          onChange={(next) => setManual({ view: next, moment: auto.moment })}
          label={t("Görünüm")}
          size="small"
          className="draft__tabs"
        />
        <p className="draft__phase">
          {draftPhaseLabel(draft.phase, lang)}
          {draft.turn?.mine && <span className="draft__turn">{draft.turn.kind === "ban" ? t("Yasak sırası sende") : t("Seçim sırası sende")}</span>}
          <span className="draft__timer" aria-label={t("{seconds} saniye kaldı", { seconds })}>
            {seconds}
          </span>
        </p>
      </header>

      <div className="draft__body">
        <section key={view} className="draft__main draft__view" aria-label={view === "draft" ? t("Draft") : t("Build")}>
          {view === "draft" ? (
            <>
              {ready && arenaAnchor > 0 && (
                <ArenaDuo
                  anchor={arenaAnchor}
                  partner={arenaPartner > 0}
                  taken={new Set([...draft.bans, ...draft.myTeam.map((m) => m.championId), ...enemyPicks])}
                  pool={new Set(pool.map((p) => p.championId))}
                  champions={ready.champions}
                  version={ready.version}
                />
              )}
              {ready && hasBench(draft) && (
                <BenchHelper
                  current={myChampion}
                  rerolls={draft.rerollsRemaining ?? 0}
                  bench={draft.bench ?? []}
                  allies={draft.myTeam.filter((m) => !m.isLocal).map(shownChampion)}
                  champions={ready.champions}
                  version={ready.version}
                />
              )}
              {role && ready && myChampion > 0 && vs && (
                <MatchupLink championId={myChampion} opponentId={vs} position={role} label={t("Eşleşme sayfasında incele")} />
              )}
              {role && !locked && ready && myChampion > 0 && vs && ready.champions.get(myChampion) && ready.champions.get(vs) && (
                <HoverMatchup
                  champion={ready.champions.get(myChampion)!}
                  role={role}
                  opponent={ready.champions.get(vs)!}
                  guessed={opponent?.guessed ?? false}
                  version={ready.version}
                />
              )}
              {role && !locked && ready && (
                <>
                  <h2 className="draft__heading">{t("{role} için öneriler", { role: positionLabel(role, lang) ?? "" })}</h2>
                  <PickSuggestions
                    role={role}
                    opponentId={vs}
                    allies={allies}
                    unavailable={unavailable}
                    champions={ready.champions}
                    version={ready.version}
                  />
                </>
              )}
              {draft.phase !== "FINALIZATION" && ready && (
                <>
                  <h2 className="draft__heading">{t("Yasak önerisi")}</h2>
                  <BanPlanner
                    subject={banSubject}
                    role={role}
                    allies={banAllies}
                    unavailable={new Set([...draft.bans, ...enemyPicks, ...allyIds])}
                    champions={ready.champions}
                    version={ready.version}
                  />
                </>
              )}
              {ready && enemyPicks.length > 0 && <ThreatsPanel enemies={enemyPicks.map((id) => ready.champions.get(id)).filter((c): c is Champion => c !== undefined)} />}
              {ready && <CompAnalysis allies={allyIds} enemies={enemyPicks} champions={ready.champions} aram={hasBench(draft)} />}
              {ready && me && <PoolStrip position={me.position} data={ready} opponentId={vs} />}
            </>
          ) : me && ready && myChampion > 0 ? (
            <>
              <PoolBuild championId={myChampion} role={role} locked={locked} />
              <BuildSuggestion
                championId={myChampion}
                championName={ready.champions.get(myChampion)?.name ?? ""}
                position={me.position || null}
                currentSpells={me.spells as [number, number]}
                locked={locked}
                vs={vs}
                enemies={enemyPicks}
                showPros
                queue={queue}
              />
              {isArena(draft) && <ArenaItems championId={myChampion} />}
              {hasBench(draft) && <ChampionAugments championId={myChampion} queue={MAYHEM} limit={6} title={t("Şamata ise: ilk bakılacak augment'ler")} hideEmpty />}
              {enemyPicks.length >= 3 && (
                <ItemAdvicePanel
                  championId={myChampion}
                  position={me.position || null}
                  queue={queue}
                  enemies={enemyPicks.map((id) => ready.champions.get(id)).filter((c): c is Champion => c !== undefined)}
                />
              )}
            </>
          ) : (
            <p className="draft__empty">{t("Bir şampiyonun üzerine geldiğinde build burada açılır.")}</p>
          )}
        </section>

        <aside className="draft__rail enter" aria-label={t("Draft bilgileri")}>
          {me && <MyPick member={me} data={ready} />}

          <OpponentPicker enemies={enemyPicks} opponent={opponent} data={ready} onChoose={chooseOpponent} />

          {view === "draft" ? (
            <>
              <h2 className="draft__heading">{t("Takımın")}</h2>
              <ul className="team">
                {draft.myTeam.map((member) => (
                  <TeamRow
                    key={member.cellId}
                    member={member}
                    data={ready}
                    duo={myChampion && role && duoPartnerRole(role) === member.position.toUpperCase() ? { championId: myChampion, position: role } : undefined}
                  />
                ))}
              </ul>
              {ready && <EnemyTips enemies={enemyPicks.map((id) => ready.champions.get(id)).filter((c) => c !== undefined)} />}
              <h2 className="draft__heading">{t("Yasaklar")}</h2>
              <ChampionStrip ids={draft.bans} data={ready} empty={t("Yasak yok")} muted />
            </>
          ) : (
            ready &&
            me &&
            myChampion > 0 && (
              <>
                {vs && <NotePreview noteKey={matchupNoteKey(myChampion, vs)} label={t("{opponent} eşleşmesi notların", { opponent: ready.champions.get(vs)?.name ?? "" })} />}
                {vs && role && ready.champions.get(vs) && (
                  <MatchupGuide championId={myChampion} position={role} opponent={ready.champions.get(vs)!} version={ready.version} />
                )}
                <LanePartner championId={myChampion} position={me.position} team={draft.myTeam} data={ready} />
                <DraftMatchups championId={myChampion} position={me.position} data={ready} />
                <JournalNote
                  noteKey={championNoteKey(myChampion)}
                  label={t("{champion} notların", { champion: ready.champions.get(myChampion)?.name ?? "" })}
                />
                {vs && (
                  <JournalNote
                    template={matchupTemplate}
                    noteKey={matchupNoteKey(myChampion, vs)}
                    label={t("{opponent} eşleşmesi notların", { opponent: ready.champions.get(vs)?.name ?? "" })}
                    placeholder={t("Bu rakibe karşı ne işe yaradı?")}
                  />
                )}
              </>
            )
          )}
        </aside>
      </div>
    </LiquidGlass>
  );
}

function OpponentPicker({
  enemies,
  opponent,
  data,
  onChoose,
}: {
  enemies: number[];
  opponent: Opponent;
  data: StaticData | null;
  onChoose: (id: number) => void;
}) {
  const t = useT();
  const name = opponent ? data?.champions.get(opponent.championId)?.name : undefined;
  return (
    <div className="opponent">
      <h2 className="draft__heading">{t("Rakip takım")}</h2>
      {enemies.length === 0 ? (
        <p className="draft__empty">{t("Henüz seçim yok")}</p>
      ) : (
        <>
          <ul className="strip strip--pickable">
            {enemies.map((id) => {
              const champion = data?.champions.get(id);
              const current = opponent?.championId === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="strip__pick"
                    aria-pressed={current}
                    data-guess={(current && opponent?.guessed) || undefined}
                    title={champion?.name}
                    onClick={() => onChoose(id)}
                  >
                    {champion && data && <img src={championIconUrl(data.version, champion.id)} alt={champion.name} width={32} height={32} />}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="opponent__note">
            {!opponent
              ? t("Koridor rakibini seç; build ve eşleşme rehberi ona göre değişir.")
              : opponent.guessed
                ? t("Koridor rakibin büyük ihtimalle {opponent}. Yanlışsa doğrusuna tıkla.", { opponent: name ?? "" })
                : t("Koridor rakibin {opponent}.", { opponent: name ?? "" })}
          </p>
        </>
      )}
    </div>
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
        {champion && data && <img src={championIconUrl(data.version, champion.id)} alt="" width={72} height={72} />}
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
                <img key={i} src={spellIconUrl(data.version, spell.id)} alt={spell.name} title={spell.name} width={24} height={24} />
              ) : null;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamRow({ member, data, duo }: { member: DraftMember; data: StaticData | null; duo?: { championId: number; position: string } }) {
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
      {duo && champion && !member.isLocal && <DuoHint mine={duo} partner={champion} partnerPosition={member.position.toUpperCase()} />}
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
  // A role the champion has no games in answers 404, so the usual roles come from the plain overview.
  const [overall] = useAsync(role && state.status === "done" && !state.value ? `ally:${championId}:any` : null, () => getChampion(championId, null));
  const overview = state.status === "done" ? (state.value ?? (overall.status === "done" ? overall.value : null)) : null;
  const check = overview && role ? checkRole(overview, role) : null;
  const own = state.status === "done" ? state.value : null;
  return (
    <span className="team__tags">
      {own && (
        <span className="team__stat" title={t("{games} maç", { games: own.games })} data-thin={own.games < 100 || undefined}>
          {own.tier ? `${own.tier}, ` : ""}
          {formatPercent(own.winRate, lang, 1)} · {t("{games} maç", { games: own.games })}
        </span>
      )}
      {check?.kind === "off" && (
        <span
          className="team__warn"
          title={
            check.usual
              ? t("{role} rolünde nadir oynanıyor; genelde {usual} oynanıyor", { role: positionLabel(role!, lang) ?? "", usual: positionLabel(check.usual, lang) ?? "" })
              : t("{role} rolünde nadir oynanıyor", { role: positionLabel(role!, lang) ?? "" })
          }
        >
          {t("Rol dışı")}
        </span>
      )}
    </span>
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

/**
 * The player's pool for this role, main picks first. With a lane opponent
 * known, each pick shows how it does against that opponent.
 */
function PoolStrip({ position, data, opponentId }: { position: string; data: StaticData; opponentId: number | null }) {
  const t = useT();
  const lang = useLang();
  const { pool } = usePersonal();
  const role = position ? position.toUpperCase() : null;
  const [counters] = useAsync(opponentId && role ? `counters:${opponentId}:${role}` : null, () => getCounters(opponentId!, role!));
  const shown = pool
    .filter((p) => !p.position || !role || p.position === role)
    .sort((a, b) => (a.rank === b.rank ? 0 : a.rank === "main" ? -1 : 1));
  if (shown.length === 0) return null;
  const opponent = opponentId ? data.champions.get(opponentId) : undefined;
  // The opponent's own matchups: their win rate against each pick, so ours is the rest.
  const against = new Map(counters.status === "done" ? counters.value.matchups.map((m) => [m.championId, m]) : []);
  return (
    <>
      <h2 className="draft__heading">{opponent ? t("Havuzun, {opponent} karşısında", { opponent: opponent.name }) : t("Havuzun")}</h2>
      <ul className="strip strip--pool">
        {shown.map((p) => {
          const champion = data.champions.get(p.championId);
          const m = against.get(p.championId);
          return (
            <li key={p.championId} title={[champion?.name, p.note].filter(Boolean).join(": ")} data-rank={p.rank}>
              {champion && <img src={championIconUrl(data.version, champion.id)} alt="" width={32} height={32} />}
              <span className="strip__rate">
                {champion?.name}
                {m && <span className="strip__vs">{t("{rate}, {games} maç", { rate: formatPercent(1 - m.winRate, lang), games: m.games })}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** How the pick does next to the lane partner already chosen, from games where both played together. */
function LanePartner({ championId, position, team, data }: { championId: number; position: string; team: DraftMember[]; data: StaticData }) {
  const t = useT();
  const lang = useLang();
  const role = position.toUpperCase();
  const partnerRole = duoPartnerRole(role);
  const partner = partnerRole ? team.find((m) => !m.isLocal && m.position.toUpperCase() === partnerRole) : undefined;
  const partnerId = partner ? shownChampion(partner) : 0;
  const [state] = useAsync(partnerId ? `allies:${championId}:${role}` : null, () => getSynergies(championId, role));
  if (!partnerId || state.status !== "done") return null;
  const champion = data.champions.get(partnerId);
  const pair = state.value.allies.find((a) => a.championId === partnerId && a.position === partnerRole);
  if (!champion) return null;
  return (
    <div className="lane-partner">
      <img src={championIconUrl(data.version, champion.id)} alt="" width={32} height={32} />
      <p className="build__note">
        {pair
          ? t("{partner} ile birlikte {rate} kazanma, {games} maç", { partner: champion.name, rate: formatPercent(pair.winRate, lang, 1), games: pair.games })
          : t("{partner} ile birlikte yeterli maç yok.", { partner: champion.name })}
      </p>
    </div>
  );
}

/** How the player's champion does next to this ally, from games where both played together. */
function DuoHint({ mine, partner, partnerPosition }: { mine: { championId: number; position: string }; partner: Champion; partnerPosition: string }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`allies:${mine.championId}:${mine.position}`, () => getSynergies(mine.championId, mine.position));
  if (state.status !== "done") return null;
  const pair = state.value.allies.find((a) => a.championId === partner.key && a.position === partnerPosition);
  if (!pair) return null;
  return (
    <span className="team__duo" data-thin={pair.games < 100 || undefined}>
      {t("Birlikte {rate}, {games} maç", { rate: formatPercent(pair.winRate, lang, 1), games: pair.games })}
    </span>
  );
}
