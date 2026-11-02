import { useMemo, useState } from "react";
import { getGameLog, getLpHistory, getProfile, getTrends, type GameRow, type Habit, type Profile } from "./api";
import { championIconUrl, champions, latestVersion, profileIconUrl, roleIconUrl, type Champion } from "./data/ddragon";
import {
  bestRole,
  byChampion,
  byRole,
  declining,
  kdaOf,
  lowerIsBetter,
  lpSince,
  netWins,
  period,
  readGoal,
  startOfDay,
  startOfWeek,
  streaks,
  tilt,
  type Tilt,
} from "./games";
import { formatPercent, useLang, useT, type Lang } from "./i18n";
import { POSITIONS, queueLabel, tierLabel, timeAgo } from "./labels";
import type { Platform, Summoner } from "./lcu";
import { addGoal, removeGoal, togglePool, usePersonal, type GoalMetric } from "./personal";
import { LpHistory } from "./ProfileExtras";
import { ProBuildList } from "./ProBuildList";
import type { CoachTarget } from "./ProfileCard";
import { MetaPicks } from "./MetaPicks";
import { GameBars, HBars, SegmentBar, TrendLine } from "./charts";
import { useSettings } from "./settings";
import { useAsync } from "./useAsync";

type Loaded = { profile: Profile; version: string; champions: Map<number, Champion> };

async function load(summoner: Summoner, platform: Platform): Promise<Loaded> {
  const [profile, version, byKey] = await Promise.all([getProfile(summoner.gameName, summoner.tagLine, platform), latestVersion(), champions()]);
  return { profile, version, champions: byKey };
}

type Props = {
  summoner: Summoner;
  platform: Platform;
  /** Changes after every game, so the numbers reload once Riot has the result. */
  refreshKey: number | null;
  onCoach: (target: CoachTarget) => void;
  onOpenMatch: (matchId: string) => void;
  onOpenChampion: (championId: number, position: string | null) => void;
};

export function Dashboard({ summoner, platform, refreshKey, onCoach, onOpenMatch, onOpenChampion }: Props) {
  const t = useT();
  const [state, retry] = useAsync(`dash:${platform}:${summoner.puuid}:${refreshKey}`, () => load(summoner, platform));

  if (state.status === "error")
    return (
      <div className="dash">
        <section className="tile tile--wide" role="alert">
          <p className="profile__message">{t("Profil alınamadı. Vizier sunucusuna şu an ulaşılamıyor.")}</p>
          <button type="button" className="button" onClick={retry}>
            {t("Tekrar dene")}
          </button>
        </section>
      </div>
    );
  if (state.status !== "done")
    return (
      <div className="dash" aria-busy="true">
        {["rank", "form", "session", "lp", "roles", "goals"].map((id) => (
          <div key={id} className={`tile tile--${id} tile--loading`} />
        ))}
      </div>
    );
  return <Body {...state.value} refreshKey={refreshKey} onCoach={onCoach} onOpenMatch={onOpenMatch} onOpenChampion={onOpenChampion} />;
}

function Body({ profile, version, champions, refreshKey, onCoach, onOpenMatch, onOpenChampion }: Loaded & Omit<Props, "summoner" | "platform">) {
  const t = useT();
  const puuid = profile.account.puuid;
  const [log] = useAsync(`log:${puuid}:${refreshKey}`, () => getGameLog(puuid));
  const [lp] = useAsync(`lp:${puuid}:${refreshKey}`, () => getLpHistory(puuid));
  const games = log.status === "done" ? log.value : null;
  const snapshots = lp.status === "done" ? lp.value : [];

  return (
    <div className="dash">
      <RankTile profile={profile} version={version} lpToday={lpSince(snapshots, startOfDay())} lpWeek={lpSince(snapshots, startOfWeek())}>
        <LpHistory puuid={puuid} key={refreshKey ?? 0} />
      </RankTile>
      <FormTile games={games} version={version} champions={champions} failed={log.status === "error"} />
      <SessionTile games={games} />
      {games && games.length > 1 && <ChartTiles games={games} version={version} champions={champions} />}
      <RolesTile games={games} />
      <GoalsTile games={games} puuid={puuid} />
      <PoolTile games={games} version={version} champions={champions} onOpenChampion={onOpenChampion} />
      <MatchesTile games={games} version={version} champions={champions} puuid={puuid} onCoach={onCoach} onOpenMatch={onOpenMatch} />
      <div className="dash__stack">
        <MyPoolTile games={games} version={version} champions={champions} onOpenChampion={onOpenChampion} />
        <section className="tile tile--pros">
          <h2 className="tile__title">{t("Son pro build'ler")}</h2>
          <ProBuildList filter={{ limit: 3 }} compact emptyText={t("Bu filtreyle henüz pro maçı yok. Vizier birkaç dakikada bir yeni maçları alıyor.")} />
        </section>
      </div>
      <div className="tile--meta">
        <MetaPicks onOpenChampion={onOpenChampion} />
      </div>
    </div>
  );
}

const signedLp = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

export function RankTile({
  profile,
  version,
  lpToday,
  lpWeek,
  children,
}: {
  profile: Profile;
  version: string;
  lpToday: number | null;
  lpWeek: number | null;
  children?: React.ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const { account, summoner, ranks } = profile;
  const solo = ranks.find((r) => r.queueType === "RANKED_SOLO_5x5");
  const others = ranks.filter((r) => r !== solo);
  return (
    <section className="tile tile--rank" aria-label={t("Dereceler")}>
      <header className="dash__who">
        {summoner && <img className="profile__icon" src={profileIconUrl(version, summoner.profileIconId)} alt="" width={48} height={48} />}
        <div>
          <h2 className="profile__name">
            {account.gameName}
            <span className="profile__tag">#{account.tagLine}</span>
          </h2>
          {summoner && <p className="profile__level">{t("Seviye {level}", { level: summoner.summonerLevel })}</p>}
        </div>
      </header>
      {solo ? (
        <>
          <p className="dash__rank">
            {tierLabel(solo.tier, solo.rank, lang)}
            <span className="dash__lp">{solo.leaguePoints} LP</span>
          </p>
          <p className="tile__meta">
            {t("{wins} galibiyet, {losses} mağlubiyet", { wins: solo.wins, losses: solo.losses })},{" "}
            {formatPercent(solo.wins / Math.max(1, solo.wins + solo.losses), lang)}
          </p>
          <dl className="dash__lpchange">
            <div>
              <dt>{t("Bugün")}</dt>
              <dd data-trend={lpToday ? (lpToday > 0 ? "up" : "down") : undefined}>{lpToday === null ? "–" : `${signedLp(lpToday)} LP`}</dd>
            </div>
            <div>
              <dt>{t("Bu hafta")}</dt>
              <dd data-trend={lpWeek ? (lpWeek > 0 ? "up" : "down") : undefined}>{lpWeek === null ? "–" : `${signedLp(lpWeek)} LP`}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="tile__meta">{t("Bu sezon Tek/Çift dereceli maç yok.")}</p>
      )}
      {others.map((r) => (
        <p key={r.queueType} className="tile__meta">
          {queueLabel(r.queueType, lang)}: {tierLabel(r.tier, r.rank, lang)}, {r.leaguePoints} LP
        </p>
      ))}
      {children}
    </section>
  );
}

function FormTile({ games, version, champions, failed }: { games: GameRow[] | null; version: string; champions: Map<number, Champion>; failed: boolean }) {
  const t = useT();
  const lang = useLang();
  if (!games)
    return (
      <section className="tile tile--form">
        <h2 className="tile__title">{t("Form")}</h2>
        <p className="tile__meta">{failed ? t("Maçlar alınamadı.") : t("Yükleniyor")}</p>
      </section>
    );
  const oldestFirst = [...games].reverse();
  const net = netWins(games);
  const run = streaks(games);
  const wins = games.filter((g) => g.win).length;
  return (
    <section className="tile tile--form" aria-label={t("Form")}>
      <div className="tile__head">
        <h2 className="tile__title">{t("Son {games} dereceli maç", { games: games.length })}</h2>
        <p className="tile__meta">
          {t("{wins} galibiyet, {losses} mağlubiyet", { wins, losses: games.length - wins })}
          {games.length > 0 && `, ${formatPercent(wins / games.length, lang)}`}
        </p>
      </div>
      {games.length === 0 ? (
        <p className="tile__meta">{t("Henüz dereceli maç yok. Oynadıkça form duvarın burada dolacak.")}</p>
      ) : (
        <>
          <ol className="wall" aria-label={t("Eskiden yeniye maç sonuçları")}>
            {oldestFirst.map((g) => {
              const champion = champions.get(g.championId);
              return (
                <li
                  key={g.matchId}
                  data-result={g.win ? "win" : "loss"}
                  title={`${champion?.name ?? ""}, ${g.win ? t("Galibiyet") : t("Mağlubiyet")}, ${g.kills}/${g.deaths}/${g.assists}, ${timeAgo(g.at, lang)}`}
                >
                  {champion && <img src={championIconUrl(version, champion.id)} alt="" width={30} height={30} loading="lazy" />}
                </li>
              );
            })}
          </ol>
          <NetWins values={net} />
          <p className="tile__meta">
            {run.current &&
              (run.current.win
                ? t("{count} maçtır kazanıyorsun", { count: run.current.length })
                : t("{count} maçtır kaybediyorsun", { count: run.current.length }))}
            {". "}
            {t("En uzun galibiyet serisi {win}, mağlubiyet serisi {loss}.", { win: run.longestWin, loss: run.longestLoss })}
          </p>
        </>
      )}
    </section>
  );
}

function NetWins({ values }: { values: number[] }) {
  const t = useT();
  const W = 300;
  const H = 64;
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values, lo + 1);
  const x = (i: number) => (values.length < 2 ? W : (i / (values.length - 1)) * W);
  const y = (v: number) => 4 + (H - 8) * (1 - (v - lo) / (hi - lo));
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const last = values[values.length - 1] ?? 0;
  return (
    <svg className="netwins" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={t("Net galibiyet: {net}", { net: last })}>
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="netwins__zero" />
      <path d={line} className="netwins__line" data-ahead={last >= 0} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const TILT_TEXT: Record<Tilt["level"], { title: string; detail: string }> = {
  0: { title: "Oturum dengeli", detail: "Arka arkaya kayıp ya da belirgin bir düşüş yok." },
  1: { title: "Dikkat, oturum kötüye gidiyor", detail: "Kısa bir ara vermek ya da normal oyuna geçmek iyi gelebilir." },
  2: { title: "Mola zamanı", detail: "Kayıplar üst üste geliyor ve oyunun düşüyor. Bir sonraki dereceliden önce ara vermeyi düşün." },
};

const REASON_TEXT = {
  lossStreak: "{count} maç üst üste kaybettin.",
  kdaDrop: "Son üç maçta KDA'n kendi ortalamanın çok altında.",
  badSession: "Bu oturumdaki maçların çoğunu kaybettin.",
} as const;

export function TiltCard({ games }: { games: GameRow[] }) {
  const t = useT();
  const reading = tilt(games);
  const text = TILT_TEXT[reading.level];
  return (
    <div className="tilt" data-level={reading.level}>
      <p className="tilt__title">{t(text.title)}</p>
      <p className="tile__meta">{t(text.detail)}</p>
      {reading.reasons.length > 0 && (
        <ul className="tilt__reasons">
          {reading.reasons.map((r) => (
            <li key={r}>{t(REASON_TEXT[r], { count: reading.lossesInRow })}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SessionTile({ games }: { games: GameRow[] | null }) {
  const t = useT();
  const lang = useLang();
  const settings = useSettings();
  const today = games ? period(games, startOfDay()) : null;
  const week = games ? period(games, startOfWeek()) : null;
  const line = (p: NonNullable<typeof today>) =>
    p.games === 0
      ? t("Maç yok")
      : `${t("{wins}G {losses}M", { wins: p.wins, losses: p.games - p.wins })}, ${formatPercent(p.wins / p.games, lang)}, ${t("{kda} KDA", { kda: p.kda!.toFixed(1) })}`;
  return (
    <section className="tile tile--session" aria-label={t("Bugün ve bu hafta")}>
      <h2 className="tile__title">{t("Bugün ve bu hafta")}</h2>
      {today && week ? (
        <>
          <dl className="dash__periods">
            <div>
              <dt>{t("Bugün")}</dt>
              <dd>{line(today)}</dd>
            </div>
            <div>
              <dt>{t("Bu hafta")}</dt>
              <dd>{line(week)}</dd>
            </div>
          </dl>
          {settings.tiltWarnings && <TiltCard games={games!} />}
        </>
      ) : (
        <p className="tile__meta">{t("Yükleniyor")}</p>
      )}
    </section>
  );
}

function RolesTile({ games }: { games: GameRow[] | null }) {
  const t = useT();
  const lang = useLang();
  const roles = games ? byRole(games) : [];
  const best = bestRole(roles);
  return (
    <section className="tile tile--roles" aria-label={t("Rollerin")}>
      <h2 className="tile__title">{t("Rollerin")}</h2>
      {roles.length > 1 && (
        <SegmentBar
          label={t("Rollere göre maç dağılımı")}
          segments={roles.slice(0, 5).map((r) => ({ key: r.position, label: t(POSITIONS[r.position] ?? r.position), value: r.games, icon: roleIconUrl(r.position) }))}
          format={(n) => formatPercent(n, lang)}
        />
      )}
      {roles.length === 0 ? (
        <p className="tile__meta">{games ? t("Rol bilgisi olan maç yok.") : t("Yükleniyor")}</p>
      ) : (
        <ul className="roles">
          {roles.map((r) => (
            <li key={r.position} data-best={r === best || undefined}>
              <img className="role-icon" src={roleIconUrl(r.position)} alt="" width={18} height={18} />
              <span className="roles__name">{t(POSITIONS[r.position] ?? r.position)}</span>
              <span className="roles__bar" aria-hidden="true">
                <span style={{ width: `${(r.wins / r.games) * 100}%` }} />
              </span>
              <span className="roles__rate">{formatPercent(r.wins / r.games, lang)}</span>
              <span className="roles__meta">
                {t("{games} maç", { games: r.games })}, {t("{kda} KDA", { kda: r.kda.toFixed(1) })}
                {r.position !== "UTILITY" && `, ${r.csPerMinute.toFixed(1)} CS/dk`}
              </span>
            </li>
          ))}
        </ul>
      )}
      {best && roles.length > 1 && <p className="tile__meta">{t("En başarılı olduğun rol: {role}.", { role: t(POSITIONS[best.position]) })}</p>}
    </section>
  );
}

export const GOAL_NAMES: Record<GoalMetric, string> = {
  cs_pm: "Dakikada minyon",
  deaths: "Ölüm sayısı",
  vision_pm: "Dakikada görüş skoru",
  kill_participation: "Skora katkı",
  kda: "KDA",
};

const GOAL_DEFAULTS: Record<GoalMetric, number> = { cs_pm: 7, deaths: 5, vision_pm: 1, kill_participation: 0.5, kda: 3 };

const HABIT_GOALS: Partial<Record<string, GoalMetric>> = { cs_pm: "cs_pm", vision_pm: "vision_pm", kill_participation: "kill_participation", deaths: "deaths" };

export function goalValue(metric: GoalMetric, value: number, lang: Lang) {
  if (metric === "kill_participation") return formatPercent(value, lang);
  return metric === "deaths" ? value.toFixed(value % 1 ? 1 : 0) : value.toFixed(1);
}

export function GoalsTile({ games, puuid }: { games: GameRow[] | null; puuid: string }) {
  const t = useT();
  const lang = useLang();
  const { goals } = usePersonal();
  const [trends] = useAsync(`trends:${puuid}`, () => getTrends(puuid));
  const [metric, setMetric] = useState<GoalMetric>("cs_pm");
  const [target, setTarget] = useState(String(GOAL_DEFAULTS.cs_pm));
  const habits: Habit[] = trends.status === "done" ? trends.value.habits : [];
  const suggestion = habits.find((h) => h.metric && HABIT_GOALS[h.metric] && h.target !== undefined && !goals.some((g) => g.metric === HABIT_GOALS[h.metric!]));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const raw = Number(target.replace(",", "."));
    if (!Number.isFinite(raw) || raw <= 0) return;
    addGoal(metric, metric === "kill_participation" && raw > 1 ? raw / 100 : raw);
  }

  return (
    <section className="tile tile--goals" aria-label={t("Hedeflerin")}>
      <h2 className="tile__title">{t("Hedeflerin")}</h2>
      {goals.length === 0 && <p className="tile__meta">{t("Bir hedef koy; Vizier son 10 dereceli maçında kaçında tuttuğunu gösterir.")}</p>}
      <ul className="goals">
        {goals.map((goal) => {
          const reading = games ? readGoal(goal, games) : null;
          return (
            <li key={goal.id}>
              <p className="goals__name">
                {t(GOAL_NAMES[goal.metric])} {lowerIsBetter(goal.metric) ? "≤" : "≥"} {goalValue(goal.metric, goal.target, lang)}
                <button type="button" className="goals__remove" aria-label={t("Hedefi kaldır")} onClick={() => removeGoal(goal.id)}>
                  ×
                </button>
              </p>
              {reading && (
                <>
                  <ol className="goals__dots" aria-label={t("Son {count} maçın {met} tanesinde tuttu", { count: reading.counted, met: reading.met })}>
                    {[...reading.recent].reverse().map((r, i) => (
                      <li key={i} data-met={r === null ? undefined : r} />
                    ))}
                  </ol>
                  <p className="tile__meta">
                    {t("Son {count} maçın {met} tanesinde tuttu", { count: reading.counted, met: reading.met })}
                    {reading.average !== null && `, ${t("ortalama {value}", { value: goalValue(goal.metric, reading.average, lang) })}`}
                  </p>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {suggestion && (
        <button
          type="button"
          className="goals__suggest"
          onClick={() => addGoal(HABIT_GOALS[suggestion.metric!]!, HABIT_GOALS[suggestion.metric!] === "deaths" ? Math.floor(suggestion.target!) : suggestion.target!)}
        >
          {t("Koçun önerisi: {habit}. Hedef olarak ekle", { habit: t(suggestion.title) })}
        </button>
      )}
      <form className="goals__form" onSubmit={submit}>
        <select
          value={metric}
          aria-label={t("Hedef türü")}
          onChange={(e) => {
            const next = e.target.value as GoalMetric;
            setMetric(next);
            setTarget(String(next === "kill_participation" ? 50 : GOAL_DEFAULTS[next]));
          }}
        >
          {(Object.keys(GOAL_NAMES) as GoalMetric[]).map((m) => (
            <option key={m} value={m}>
              {t(GOAL_NAMES[m])}
            </option>
          ))}
        </select>
        <input inputMode="decimal" value={target} aria-label={t("Hedef değeri")} onChange={(e) => setTarget(e.target.value)} />
        <button type="submit" className="button">
          {t("Ekle")}
        </button>
      </form>
    </section>
  );
}

function PoolTile({
  games,
  version,
  champions,
  onOpenChampion,
}: {
  games: GameRow[] | null;
  version: string;
  champions: Map<number, Champion>;
  onOpenChampion: (championId: number, position: string | null) => void;
}) {
  const t = useT();
  const lang = useLang();
  const lines = useMemo(() => (games ? byChampion(games) : []), [games]);
  const drops = useMemo(() => (games ? declining(games) : []), [games]);

  const icon = (id: number, size = 28) => {
    const c = champions.get(id);
    return c ? <img src={championIconUrl(version, c.id)} alt="" width={size} height={size} /> : null;
  };

  return (
    <section className="tile tile--pool" aria-label={t("Şampiyon havuzu")}>
      <h2 className="tile__title">{t("En iyi oynadıkların")}</h2>
      {lines.length === 0 ? (
        <p className="tile__meta">{games ? t("Henüz dereceli maç yok.") : t("Yükleniyor")}</p>
      ) : (
        <ul className="pool">
          {[...lines]
            .sort((a, b) => b.wins / b.games + b.games / 40 - (a.wins / a.games + a.games / 40))
            .slice(0, 5)
            .map((c) => (
              <li key={c.championId}>
                <button type="button" className="pool__open" onClick={() => onOpenChampion(c.championId, null)}>
                  {icon(c.championId)}
                  <span className="pool__name">{champions.get(c.championId)?.name ?? c.championId}</span>
                </button>
                <span className="pool__games">{t("{games} maç", { games: c.games })}</span>
                <span className="pool__rate">{formatPercent(c.wins / c.games, lang)}</span>
                <span className="pool__kda">{t("{kda} KDA", { kda: c.kda.toFixed(1) })}</span>
              </li>
            ))}
        </ul>
      )}
      {drops.length > 0 && (
        <>
          <h3 className="tile__subtitle">{t("Son maçlarda düşüşte")}</h3>
          <ul className="pool pool--drops">
            {drops.map((d) => (
              <li key={d.championId}>
                <span className="pool__open">
                  {icon(d.championId, 24)}
                  <span className="pool__name">{champions.get(d.championId)?.name}</span>
                </span>
                <span className="pool__games" title={t("Önceki maçlar")}>
                  {formatPercent(d.before.wins / d.before.games, lang)} → {formatPercent(d.lately.wins / d.lately.games, lang)}
                </span>
                <span className="pool__kda">
                  {d.before.kda.toFixed(1)} → {d.lately.kda.toFixed(1)} KDA
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function MyPoolTile({
  games,
  version,
  champions,
  onOpenChampion,
}: {
  games: GameRow[] | null;
  version: string;
  champions: Map<number, Champion>;
  onOpenChampion: (championId: number, position: string | null) => void;
}) {
  const t = useT();
  const lang = useLang();
  const personal = usePersonal();
  const [adding, setAdding] = useState("");
  const lines = useMemo(() => (games ? byChampion(games) : []), [games]);
  const byName = useMemo(() => new Map([...champions.values()].map((c) => [c.name.toLocaleLowerCase(lang), c])), [champions, lang]);

  function add(event: React.FormEvent) {
    event.preventDefault();
    const champion = byName.get(adding.trim().toLocaleLowerCase(lang));
    if (!champion) return;
    if (!personal.pool.some((p) => p.championId === champion.key)) togglePool(champion.key, null);
    setAdding("");
  }

  const icon = (id: number, size = 28) => {
    const c = champions.get(id);
    return c ? <img src={championIconUrl(version, c.id)} alt="" width={size} height={size} /> : null;
  };

  return (
    <section className="tile tile--mypool" aria-label={t("Havuzum")}>
      <h2 className="tile__title">{t("Havuzum")}</h2>
      {personal.pool.length === 0 ? (
        <p className="tile__meta">{t("Oynamak istediğin şampiyonları ekle; şampiyon seçiminde ve sıra beklerken öne çıkarlar.")}</p>
      ) : (
        <ul className="mypool">
          {personal.pool.map((p) => {
            const line = lines.find((l) => l.championId === p.championId);
            return (
              <li key={p.championId}>
                <button type="button" className="mypool__open" onClick={() => onOpenChampion(p.championId, p.position)} title={champions.get(p.championId)?.name}>
                  {icon(p.championId, 34)}
                  <span>{line ? formatPercent(line.wins / line.games, lang) : "–"}</span>
                </button>
                <button type="button" className="mypool__remove" aria-label={t("Havuzdan çıkar")} onClick={() => togglePool(p.championId, p.position)}>
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form className="goals__form" onSubmit={add}>
        <input list="pool-champions" value={adding} placeholder={t("Şampiyon ekle")} aria-label={t("Şampiyon ekle")} onChange={(e) => setAdding(e.target.value)} />
        <datalist id="pool-champions">
          {[...champions.values()].map((c) => (
            <option key={c.key} value={c.name} />
          ))}
        </datalist>
        <button type="submit" className="button">
          {t("Ekle")}
        </button>
      </form>
    </section>
  );
}

function MatchesTile({
  games,
  version,
  champions,
  puuid,
  onCoach,
  onOpenMatch,
}: {
  games: GameRow[] | null;
  version: string;
  champions: Map<number, Champion>;
  puuid: string;
  onCoach: (target: CoachTarget) => void;
  onOpenMatch: (matchId: string) => void;
}) {
  const t = useT();
  const lang = useLang();
  return (
    <section className="tile tile--matches" aria-label={t("Son maçlar")}>
      <h2 className="tile__title">{t("Son maçlar")}</h2>
      {!games ? (
        <p className="tile__meta">{t("Yükleniyor")}</p>
      ) : games.length === 0 ? (
        <p className="tile__meta">{t("Henüz maç yok. Oynadığın maçlar burada görünecek.")}</p>
      ) : (
        <ul className="matches">
          {games.slice(0, 7).map((g) => {
            const champion = champions.get(g.championId);
            return (
              <li key={g.matchId} data-result={g.win ? "win" : "loss"}>
                <button
                  type="button"
                  className="matches__open"
                  aria-label={t("{champion} maçının detayını aç", { champion: champion?.name ?? t("Maç") })}
                  onClick={() => onOpenMatch(g.matchId)}
                />
                {champion && <img src={championIconUrl(version, champion.id)} alt="" width={32} height={32} className="matches__icon" />}
                <span className="matches__champion">{champion?.name ?? t("Bilinmeyen şampiyon")}</span>
                <span className="matches__result">
                  {g.win ? t("Galibiyet") : t("Mağlubiyet")}, {g.kills}/{g.deaths}/{g.assists}, {kdaOf(g).toFixed(1)} KDA
                </span>
                <span className="matches__kda">{Math.round(g.cs)} CS</span>
                <span className="matches__when">{timeAgo(g.at, lang)}</span>
                <button
                  type="button"
                  className="matches__coach"
                  onClick={() => onCoach({ matchId: g.matchId, puuid, championName: champion?.name ?? t("Bilinmeyen şampiyon") })}
                >
                  {t("Analiz et")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ChartTiles({ games, version, champions }: { games: GameRow[]; version: string; champions: Map<number, Champion> }) {
  const t = useT();
  const lang = useLang();
  const { goals } = usePersonal();
  const oldestFirst = [...games].reverse();
  const describe = (g: GameRow) => {
    const champion = champions.get(g.championId);
    return (
      <span className="chart__game">
        {champion && <img src={championIconUrl(version, champion.id)} alt="" width={18} height={18} />}
        {champion?.name}, {g.win ? t("Galibiyet") : t("Mağlubiyet")}, {g.kills}/{g.deaths}/{g.assists}
      </span>
    );
  };
  const csGoal = goals.find((g) => g.metric === "cs_pm")?.target ?? null;
  const champs = byChampion(games)
    .filter((c) => c.games >= 2)
    .sort((a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games)
    .slice(0, 6);
  return (
    <>
      <section className="tile tile--chart" aria-label={t("Maç maç KDA")}>
        <div className="tile__head">
          <h2 className="tile__title">{t("Maç maç KDA")}</h2>
          <p className="tile__meta">{t("Eskiden yeniye")}</p>
        </div>
        <GameBars
          label={t("Son {games} maçta KDA", { games: games.length })}
          bars={oldestFirst.map((g) => ({ value: kdaOf(g), win: g.win, label: describe(g) }))}
          format={(n) => `${n.toFixed(1)} KDA`}
        />
        <p className="chart__legend">
          <span data-result="win">{t("Galibiyet")}</span>
          <span data-result="loss">{t("Mağlubiyet")}</span>
        </p>
      </section>
      <section className="tile tile--chart" aria-label={t("Dakikada minyon")}>
        <div className="tile__head">
          <h2 className="tile__title">{t("Dakikada minyon")}</h2>
          <p className="tile__meta">
            {t("ortalama {value}", { value: (oldestFirst.reduce((s, g) => s + g.cs / Math.max(1, g.minutes), 0) / oldestFirst.length).toFixed(1) })}
          </p>
        </div>
        <TrendLine
          label={t("Maç maç dakikada minyon")}
          values={oldestFirst.map((g) => g.cs / Math.max(1, g.minutes))}
          target={csGoal}
          format={(n) => n.toFixed(1)}
          pointLabel={(i) => describe(oldestFirst[i])}
        />
        {csGoal === null && <p className="tile__meta">{t("Hedeflerine dakikada minyon eklersen çizgisi burada görünür.")}</p>}
      </section>
      <section className="tile tile--chart" aria-label={t("Şampiyonlarına göre kazanma")}>
        <h2 className="tile__title">{t("Şampiyonlarına göre kazanma")}</h2>
        {champs.length === 0 ? (
          <p className="tile__meta">{t("En az iki maç oynadığın şampiyon olunca burada sıralanır.")}</p>
        ) : (
          <HBars
            max={1}
            format={(n) => formatPercent(n, lang)}
            bars={champs.map((c, i) => {
              const champion = champions.get(c.championId);
              return {
                key: c.championId,
                emphasis: i === 0,
                value: c.wins / c.games,
                label: (
                  <>
                    {champion && <img src={championIconUrl(version, champion.id)} alt="" width={20} height={20} />}
                    {champion?.name}
                  </>
                ),
                note: t("{games} maç, {kda} KDA", { games: c.games, kda: c.kda.toFixed(1) }),
              };
            })}
          />
        )}
      </section>
    </>
  );
}

/** Someone else's profile from search: the same tiles, without the personal ones. */
export function PublicDashboard({
  summoner,
  platform,
  onCoach,
  onOpenMatch,
  onOpenChampion,
}: Omit<Props, "refreshKey" | "onOpenMatch"> & { onOpenMatch: (matchId: string, puuid: string) => void }) {
  const t = useT();
  const [state, retry] = useAsync(`public:${platform}:${summoner.gameName}#${summoner.tagLine}`, () => load(summoner, platform));
  const puuid = state.status === "done" ? state.value.profile.account.puuid : null;
  const [log] = useAsync(puuid ? `log:${puuid}` : null, () => getGameLog(puuid!));
  const [lp] = useAsync(puuid ? `lp:${puuid}` : null, () => getLpHistory(puuid!));
  if (state.status === "error")
    return (
      <div className="dash">
        <section className="tile tile--wide" role="alert">
          <p className="profile__message">{t("Profil alınamadı. Vizier sunucusuna şu an ulaşılamıyor.")}</p>
          <button type="button" className="button" onClick={retry}>
            {t("Tekrar dene")}
          </button>
        </section>
      </div>
    );
  if (state.status !== "done") return <div className="dash" aria-busy="true"><div className="tile tile--rank tile--loading" /></div>;
  const { profile, version, champions } = state.value;
  const games = log.status === "done" ? log.value : null;
  const snapshots = lp.status === "done" ? lp.value : [];
  return (
    <div className="dash">
      <RankTile profile={profile} version={version} lpToday={lpSince(snapshots, startOfDay())} lpWeek={lpSince(snapshots, startOfWeek())}>
        <LpHistory puuid={profile.account.puuid} />
      </RankTile>
      <FormTile games={games} version={version} champions={champions} failed={log.status === "error"} />
      <RolesTile games={games} />
      {games && games.length > 1 && <ChartTiles games={games} version={version} champions={champions} />}
      <PoolTile games={games} version={version} champions={champions} onOpenChampion={onOpenChampion} />
      <MatchesTile games={games} version={version} champions={champions} puuid={profile.account.puuid} onCoach={onCoach} onOpenMatch={(id) => onOpenMatch(id, profile.account.puuid)} />
    </div>
  );
}
