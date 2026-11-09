import { useMemo, useState } from "react";
import { CATEGORIES, CATEGORY_TEXT, SLOT_ROLES, type Category, type Scenario } from "../challenge/scenarios";
import { advance, answerFor, choicesOf, finished, grade, pick, record, replayMissed, startSession, summary, type Filter, type Session, type Verdict } from "../challenge/session";
import { championIconUrl, champions, latestVersion, type Champion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { loadErrorMessage } from "../loadError";
import { Button } from "../ui/Button";
import { DataBadge } from "../ui/DataBadge";
import { SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import { useOnline } from "../useOnline";
import "./ChallengePage.css";

async function load() {
  const [version, all] = await Promise.all([latestVersion(), champions()]);
  const byId = new Map<string, Champion>([...all.values()].map((c) => [c.id, c]));
  return { version, byId };
}
type Data = Awaited<ReturnType<typeof load>>;

/** Draft scenarios to think through: pick an answer, then read why it works and what else would. */
export function ChallengePage() {
  const t = useT();
  const online = useOnline();
  const [data, retry] = useAsync("challenge-static", load);
  const [filter, setFilter] = useState<Filter>({ category: "all", difficulty: 0 });
  const [session, setSession] = useState<Session | null>(null);
  return (
    <LiquidGlass className="panel tiers challenge" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Draft meydan okuması")} subtitle={t("Bir draft durumu, bir soru: ne seçersin? Cevaptan sonra nedenini ve işe yarayan diğer seçimleri görürsün.")} />
      {data.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(data.error, online))} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : session ? (
        <Play data={data.value} session={session} onChange={setSession} onQuit={() => setSession(null)} filter={filter} />
      ) : (
        <Start filter={filter} onFilter={setFilter} onStart={(s) => setSession(startSession(s))} />
      )}
    </LiquidGlass>
  );
}

function Start({ filter, onFilter, onStart }: { filter: Filter; onFilter: (f: Filter) => void; onStart: (list: Scenario[]) => void }) {
  const t = useT();
  const list = useMemo(() => pick(filter), [filter]);
  return (
    <div className="challenge__start">
      <p className="section-badge">
        <DataBadge editorial source={t("Vizier'in elle yazdığı senaryolar; maç verisi değil.")} />
      </p>
      <div className="challenge__filters">
        <Select
          label={t("Konu")}
          value={filter.category}
          options={[{ value: "all", label: t("Hepsi") }, ...CATEGORIES.map((c) => ({ value: c, label: t(CATEGORY_TEXT[c]) }))]}
          onChange={(category) => onFilter({ ...filter, category: category as Category | "all" })}
        />
        <Select
          label={t("Zorluk")}
          value={String(filter.difficulty)}
          options={[
            { value: "0", label: t("Hepsi") },
            { value: "1", label: t("Kolay") },
            { value: "2", label: t("Orta") },
            { value: "3", label: t("Zor") },
          ]}
          onChange={(d) => onFilter({ ...filter, difficulty: Number(d) as Filter["difficulty"] })}
        />
      </div>
      {list.length === 0 ? (
        <EmptyState title={t("Senaryo yok")}>{t("Bu filtreyle senaryo bulunamadı.")}</EmptyState>
      ) : (
        <Button variant="primary" onClick={() => onStart(list)}>
          {t("{count} senaryoyla başla", { count: list.length })}
        </Button>
      )}
    </div>
  );
}

function Play({ data, session, onChange, onQuit, filter }: { data: Data; session: Session; onChange: (s: Session | null) => void; onQuit: () => void; filter: Filter }) {
  const t = useT();
  const scenarios = useMemo(() => new Map(pick({ category: "all", difficulty: 0 }).map((s) => [s.id, s])), []);
  if (finished(session)) {
    const sum = summary(session);
    const replay = replayMissed(session, [...scenarios.values()]);
    return (
      <div className="challenge__done">
        <h2 className="draft__heading">{t("Bitti")}</h2>
        <p>{t("{accepted} / {total} senaryoda işe yarayan bir seçim yaptın.", { accepted: sum.accepted, total: sum.total })}</p>
        {sum.other > 0 && <p className="build__note">{t("{count} seçimin senaryonun listesinde yoktu; doğru ya da yanlış sayılmadı.", { count: sum.other })}</p>}
        <div className="challenge__actions">
          {replay && <Button onClick={() => onChange(replay)}>{t("Kaçırdıklarını tekrar oyna ({count})", { count: Object.values(session.results).filter((v) => v === "rejected").length })}</Button>}
          <Button variant="primary" onClick={() => onChange(startSession(pick(filter)))}>{t("Yeniden başla")}</Button>
          <Button variant="ghost" onClick={onQuit}>{t("Konulara dön")}</Button>
        </div>
      </div>
    );
  }
  const scenario = scenarios.get(session.queue[session.index])!;
  return <Question key={scenario.id} data={data} scenario={scenario} session={session} onChange={onChange} onQuit={onQuit} />;
}

function TeamRow({ data, team, label }: { data: Data; team: (string | null)[]; label: string }) {
  const t = useT();
  return (
    <div className="challenge__team">
      <h3 className="build__stat">{label}</h3>
      <ul>
        {team.map((id, i) => {
          const champion = id ? data.byId.get(id) : undefined;
          return (
            <li key={i} title={champion?.name}>
              {champion ? <img src={championIconUrl(data.version, champion.id)} alt={champion.name} width={40} height={40} /> : <span className="challenge__empty">?</span>}
              <span className="build__stat">{t(POSITIONS[SLOT_ROLES[i]])}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Question({ data, scenario, session, onChange, onQuit }: { data: Data; scenario: Scenario; session: Session; onChange: (s: Session | null) => void; onQuit: () => void }) {
  const t = useT();
  const lang = useLang();
  const [choices] = useState(() => choicesOf(scenario));
  const [picked, setPicked] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const text = (x: { tr: string; en: string }) => (lang === "en" ? x.en : x.tr);
  const name = (id: string) => data.byId.get(id)?.name ?? id;
  const matches = query.trim()
    ? [...data.byId.values()].filter((c) => c.name.toLocaleLowerCase(lang).includes(query.trim().toLocaleLowerCase(lang))).slice(0, 6)
    : [];
  const choose = (id: string) => {
    if (picked) return;
    setPicked(id);
    onChange(record(session, grade(scenario, id)));
  };
  const verdict: Verdict | null = picked ? grade(scenario, picked) : null;
  const reason = picked ? answerFor(scenario, picked) : undefined;
  const taken = new Set([...scenario.blue, ...scenario.red, ...scenario.bans]);
  const sum = summary(session);

  return (
    <div className="challenge__play">
      <p className="build__stat">
        {t("Senaryo {n} / {total}", { n: session.index + 1, total: session.queue.length })} · {t(CATEGORY_TEXT[scenario.category])} · {t("Rol: {role}", { role: t(POSITIONS[scenario.role]) })}
        {sum.answered > 0 && ` · ${t("{accepted} işe yarayan seçim", { accepted: sum.accepted })}`}
      </p>
      <div className="challenge__teams">
        <TeamRow data={data} team={scenario.blue} label={t("Takımın")} />
        <TeamRow data={data} team={scenario.red} label={t("Rakip")} />
      </div>
      {scenario.bans.length > 0 && <p className="build__note">{t("Yasaklılar: {list}", { list: scenario.bans.map(name).join(", ") })}</p>}
      <h2 className="challenge__question">{text(scenario.question)}</h2>
      <ul className="challenge__choices">
        {choices.map((id) => (
          <li key={id}>
            <button type="button" className="challenge__choice" disabled={!!picked} data-picked={id === picked || undefined} data-verdict={picked ? grade(scenario, id) : undefined} onClick={() => choose(id)}>
              <img src={championIconUrl(data.version, id)} alt="" width={36} height={36} />
              {name(id)}
            </button>
          </li>
        ))}
      </ul>
      {!picked && (
        <div className="challenge__free">
          <SearchInput label={t("Başka bir şampiyon seç")} placeholder={t("Başka bir şampiyon seç")} value={query} onChange={setQuery} />
          <ul className="challenge__choices">
            {matches
              .filter((c) => !taken.has(c.id))
              .map((c) => (
                <li key={c.id}>
                  <button type="button" className="challenge__choice" onClick={() => choose(c.id)}>
                    <img src={championIconUrl(data.version, c.id)} alt="" width={36} height={36} />
                    {c.name}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      {picked && verdict && (
        <section className="challenge__answer" data-verdict={verdict} aria-live="polite">
          <h3 className="draft__heading">
            {verdict === "accepted" ? t("İşe yarar") : verdict === "rejected" ? t("Soruyu kaçırıyor") : t("Listede yok")}: {name(picked)}
          </h3>
          <p>{reason ? text(reason.why) : t("Bu seçim senaryonun listesinde yok; doğru ya da yanlış sayılmaz. Aşağıdaki seçimlerle karşılaştır.")}</p>
          <p>{text(scenario.lesson)}</p>
          <h4 className="build__stat">{t("İşe yarayan seçimler")}</h4>
          <ul className="challenge__why">
            {scenario.accepted.map((a) => (
              <li key={a.champion}>
                <strong>{name(a.champion)}</strong>: {text(a.why)}
              </li>
            ))}
          </ul>
          {scenario.rejected.length > 0 && (
            <>
              <h4 className="build__stat">{t("Akla gelen ama kaçıran seçimler")}</h4>
              <ul className="challenge__why">
                {scenario.rejected.map((a) => (
                  <li key={a.champion}>
                    <strong>{name(a.champion)}</strong>: {text(a.why)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="challenge__actions">
            <Button variant="primary" onClick={() => onChange(advance(session))}>
              {session.index + 1 >= session.queue.length ? t("Sonucu gör") : t("Sonraki senaryo")}
            </Button>
          </div>
        </section>
      )}
      <div className="challenge__actions">
        <Button variant="ghost" size="small" onClick={onQuit}>
          {t("Bırak")}
        </Button>
      </div>
    </div>
  );
}
