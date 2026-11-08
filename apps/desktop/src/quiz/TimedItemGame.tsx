import { useEffect, useMemo, useRef, useState } from "react";
import { itemIconUrl, items, latestVersion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { Button } from "../ui/Button";
import { ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import { betterScore, itemPool, shuffled, TIMED_SECONDS } from "./logic";
import { readTimedBest, saveTimedBest } from "./store";

async function load() {
  const [version, all] = await Promise.all([latestVersion(), items()]);
  return { version, pool: itemPool(all.values()) };
}

/** Name as many blurred items as possible in a minute; a skip costs nothing but time. */
export function TimedItemGame() {
  const t = useT();
  const [data, retry] = useAsync("quiz-items", load);
  if (data.status === "error") return <ErrorState message={t("Oyun verisi alınamadı.")} onRetry={retry} />;
  if (data.status !== "done") return <Skeleton lines={4} label={t("Yükleniyor")} />;
  return <Run version={data.value.version} pool={data.value.pool} />;
}

type Phase = "ready" | "running" | "done";

function Run({ version, pool }: { version: string; pool: ReturnType<typeof itemPool> }) {
  const t = useT();
  const lang = useLang();
  const [phase, setPhase] = useState<Phase>("ready");
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const order = useMemo(() => shuffled(pool, seed), [pool, seed]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [left, setLeft] = useState(TIMED_SECONDS);
  const [query, setQuery] = useState("");
  const [best, setBest] = useState<number | null>(readTimedBest);
  const [newBest, setNewBest] = useState(false);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    if (phase !== "running") return;
    const timer = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "running" || left > 0) return;
    const final = scoreRef.current;
    setNewBest(final > 0 && (best === null || final > best));
    if (final > 0) {
      const next = betterScore(best, final);
      setBest(next);
      saveTimedBest(next);
    }
    setPhase("done");
  }, [left, phase, best]);

  const current = order[index % order.length];
  const norm = (text: string) => text.toLocaleLowerCase(lang).replace(/[^\p{L}\p{N}]/gu, "");

  function start() {
    setSeed(Math.floor(Math.random() * 1e9));
    setIndex(0);
    setScore(0);
    setLeft(TIMED_SECONDS);
    setQuery("");
    setPhase("running");
  }

  function change(value: string) {
    setQuery(value);
    if (norm(value) === norm(current.name)) {
      setScore(score + 1);
      setIndex(index + 1);
      setQuery("");
    }
  }

  if (phase === "ready") {
    return (
      <div className="quiz__game">
        <p className="build__note">{t("{seconds} saniyede olabildiğince çok eşya bil. İkon bulanık; adı tam yaz, geçmek için Geç'e bas.", { seconds: TIMED_SECONDS })}</p>
        {best !== null && <p className="build__note">{t("En iyi skor: {score}", { score: best })}</p>}
        <Button variant="primary" onClick={start}>
          {t("Başla")}
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="quiz__result" role="status" data-solved={score > 0 || undefined}>
        <div>
          <p className="quiz__answer">{t("{score} eşya bildin", { score })}</p>
          <p className="build__note">
            {newBest ? t("Yeni en iyi skor!") : best !== null ? t("En iyi skor: {score}", { score: best }) : ""}
          </p>
        </div>
        <Button variant="primary" onClick={start}>
          {t("Yeni tur")}
        </Button>
      </div>
    );
  }

  return (
    <div className="quiz__game">
      <p className="build__note" aria-live="off">
        {t("Kalan süre: {seconds} sn", { seconds: left })}
        {" · "}
        {t("Skor: {score}", { score })}
      </p>
      <div className="quiz__ability">
        <img src={itemIconUrl(version, current.id)} alt={t("Tahmin edilecek eşya")} width={96} height={96} style={{ filter: "blur(4px)" }} />
        <p className="build__note quiz__hint">{t("Fiyatı: {gold} altın", { gold: current.gold.toLocaleString(lang === "tr" ? "tr" : "en-GB") })}</p>
      </div>
      <form className="quiz__guess" onSubmit={(e) => e.preventDefault()}>
        <input className="text-input quiz__input" aria-label={t("Eşya tahmin et")} placeholder={t("Eşya adı yaz")} value={query} autoFocus onChange={(e) => change(e.target.value)} />
        <Button
          variant="ghost"
          onClick={() => {
            setIndex(index + 1);
            setQuery("");
          }}
        >
          {t("Geç")}
        </Button>
      </form>
    </div>
  );
}
