import { useEffect, useState } from "react";
import { getCounters } from "../api";
import { championDetail, itemDetails, items as loadItems, runes as loadRunes, type Champion } from "../data/ddragon";
import { DataBadge } from "../ui/DataBadge";
import { useLang, useT } from "../i18n";
import { Button } from "../ui/Button";
import { Select, Toggle } from "../ui/Fields";
import { ErrorState, Skeleton } from "../ui/States";
import type { ChampionRoles } from "../pages/ChampionsPage";
import { buildExam, EXAM_CATEGORIES, EXAM_CATEGORY_TEXT, summarize, type ExamCategory, type ExamResult, type Question } from "./exam";
import { recordExam } from "./store";

const COUNT = 10;
const SECONDS = 20;

type Setup = { category: ExamCategory | "all"; difficulty: 1 | 2 | 3; timed: boolean };

/** Multiple-choice questions on abilities, items, runes, matchups, plans, pairs, roles and mechanics. */
export function ExamGame({ data }: { data: ChampionRoles }) {
  const t = useT();
  const lang = useLang();
  const [setup, setSetup] = useState<Setup>({ category: "all", difficulty: 2, timed: false });
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [run, setRun] = useState(0);

  async function start(category: Setup["category"] = setup.category, again?: Question[]) {
    setFailed(false);
    if (again) {
      setQuestions(again);
      setRun((n) => n + 1);
      return;
    }
    setLoading(true);
    try {
      const [items, details, runes] = await Promise.all([loadItems(), itemDetails(), loadRunes()]);
      const list = [...data.champions.values()];
      const made = await buildExam(category, setup.difficulty, COUNT, {
        champions: list,
        roles: data.roles,
        items,
        itemDetails: details,
        runes,
        lang,
        t,
        abilityNames: async (c: Champion) => (await championDetail(c.id, lang)).abilities.map((a) => a.name),
        counters: (id, role) => getCounters(id, role).catch(() => null),
      });
      if (made.length === 0) setFailed(true);
      else {
        setQuestions(made);
        setRun((n) => n + 1);
      }
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Skeleton lines={4} label={t("Sorular hazırlanıyor")} />;
  if (questions) return <Run key={run} questions={questions} timed={setup.timed} onAgain={(qs) => start(setup.category, qs)} onQuit={() => setQuestions(null)} />;
  return (
    <div className="quiz__game exam__setup">
      <div className="exam__fields">
        <Select
          label={t("Konu")}
          value={setup.category}
          options={[{ value: "all", label: t("Hepsi") }, ...EXAM_CATEGORIES.map((c) => ({ value: c, label: t(EXAM_CATEGORY_TEXT[c]) }))]}
          onChange={(category) => setSetup({ ...setup, category: category as Setup["category"] })}
        />
        <Select
          label={t("Zorluk")}
          value={String(setup.difficulty)}
          options={[
            { value: "1", label: t("Kolay") },
            { value: "2", label: t("Orta") },
            { value: "3", label: t("Zor") },
          ]}
          onChange={(d) => setSetup({ ...setup, difficulty: Number(d) as Setup["difficulty"] })}
        />
      </div>
      <Toggle label={t("Süreli")} hint={t("Her soru için {seconds} saniye.", { seconds: SECONDS })} checked={setup.timed} onChange={(timed) => setSetup({ ...setup, timed })} />
      {failed && <ErrorState message={t("Bu seçimle soru hazırlanamadı; veri eksik olabilir.")} onRetry={() => start()} />}
      <Button variant="primary" onClick={() => start()}>
        {t("{count} soruyla başla", { count: COUNT })}
      </Button>
      <p className="build__note">{t("Sonuçların bu bilgisayarda tutulur; sıralama yok.")}</p>
    </div>
  );
}

function Run({ questions, timed, onAgain, onQuit }: { questions: Question[]; timed: boolean; onAgain: (questions: Question[]) => void; onQuit: () => void }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<ExamResult[]>([]);
  const done = index >= questions.length;

  useEffect(() => {
    if (done) recordExam(results.map((r) => ({ category: r.question.category, correct: r.picked === r.question.answer })));
    // Results are final once the last question is done.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  if (done) {
    const s = summarize(results);
    return (
      <div className="quiz__game exam__done">
        <h2 className="draft__heading">{t("{correct} / {total} doğru", { correct: s.correct, total: s.total })}</h2>
        {s.missed.length > 0 && (
          <>
            <h3 className="build__stat">{t("Kaçırdıkların")}</h3>
            <ul className="exam__review">
              {s.missed.map((r) => (
                <li key={r.question.id}>
                  <p>{t(...r.question.prompt)}</p>
                  <p className="build__stat">
                    {r.picked === null ? t("Süre doldu") : t("Cevabın: {choice}", { choice: r.question.choices[r.picked] })} · {t("Doğrusu: {choice}", { choice: r.question.choices[r.question.answer] })}
                  </p>
                  <p>{t(...r.question.explain)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="exam__actions">
          {s.missed.length > 0 && <Button onClick={() => onAgain(s.missed.map((r) => r.question))}>{t("Kaçırdıklarını tekrar oyna ({count})", { count: s.missed.length })}</Button>}
          <Button variant="primary" onClick={onQuit}>
            {t("Yeniden başla")}
          </Button>
        </div>
      </div>
    );
  }
  return <Ask key={index} question={questions[index]} n={index + 1} total={questions.length} timed={timed} onDone={(picked) => { setResults([...results, { question: questions[index], picked }]); setIndex(index + 1); }} />;
}

function Ask({ question, n, total, timed, onDone }: { question: Question; n: number; total: number; timed: boolean; onDone: (picked: number | null) => void }) {
  const t = useT();
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const [left, setLeft] = useState(SECONDS);
  useEffect(() => {
    if (!timed || picked !== undefined) return;
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [timed, picked]);
  useEffect(() => {
    if (timed && left <= 0 && picked === undefined) setPicked(null);
  }, [timed, left, picked]);
  const answered = picked !== undefined;
  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
  };
  return (
    <div className="quiz__game exam__ask">
      <p className="build__stat">
        {t("Soru {n} / {total}", { n, total })} · {t(EXAM_CATEGORY_TEXT[question.category])}
        {timed && !answered && ` · ${t("{seconds} sn", { seconds: left })}`}
      </p>
      <h2 className="exam__prompt">{t(...question.prompt)}</h2>
      <ul className="exam__choices">
        {question.choices.map((choice, i) => (
          <li key={choice}>
            <button type="button" className="exam__choice" disabled={answered} data-state={answered ? (i === question.answer ? "right" : i === picked ? "wrong" : undefined) : undefined} onClick={() => choose(i)}>
              {choice}
            </button>
          </li>
        ))}
      </ul>
      {answered && (
        <div className="exam__explain" aria-live="polite">
          <p>{picked === question.answer ? t("Doğru.") : picked === null ? t("Süre doldu.") : t("Yanlış.")}</p>
          <p>{t(...question.explain)}</p>
          {question.sample && (
            <p>
              <DataBadge games={question.sample.games} winRate={question.sample.winRate} source={t("Eşleşme verisi")} />
            </p>
          )}
          <Button variant="primary" onClick={() => onDone(picked ?? null)}>
            {n >= total ? t("Sonucu gör") : t("Sonraki soru")}
          </Button>
        </div>
      )}
    </div>
  );
}
