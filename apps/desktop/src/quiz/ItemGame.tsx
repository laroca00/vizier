import { useState } from "react";
import { itemIconUrl, items, latestVersion, type Item } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { Button } from "../ui/Button";
import { ErrorState, Skeleton } from "../ui/States";
import { useToast } from "../ui/Toast";
import { useAsync } from "../useAsync";
import { dailyPick, dayKey, hash, itemBlur, itemPool, streak } from "./logic";
import { recordFor, saveRecord, useQuizRecords } from "./store";

async function load() {
  const [version, all] = await Promise.all([latestVersion(), items()]);
  return { version, pool: itemPool(all.values()) };
}

// Wrong guesses before the price, then the first letter, show as hints.
const PRICE_HINT_AFTER = 3;
const LETTER_HINT_AFTER = 5;

/** Guess a finished item from its icon, blurred and grey at first. */
export function ItemGame({ play, onNext }: { play: "daily" | "free"; onNext: () => void }) {
  const t = useT();
  const [data, retry] = useAsync("quiz-items", load);
  if (data.status === "error") return <ErrorState message={t("Oyun verisi alınamadı.")} onRetry={retry} />;
  if (data.status !== "done") return <Skeleton lines={4} label={t("Yükleniyor")} />;
  return <Round play={play} version={data.value.version} pool={data.value.pool} onNext={onNext} />;
}

function Round({ play, version, pool, onNext }: { play: "daily" | "free"; version: string; pool: Item[]; onNext: () => void }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const records = useQuizRecords();
  const today = dayKey(new Date());
  const [freeSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const answer = play === "daily" ? dailyPick(pool, today, "item") : pool[(freeSeed ^ hash("item")) % pool.length];
  const saved = play === "daily" ? recordFor(records, today, "item") : undefined;
  const [guesses, setGuesses] = useState<number[]>(saved?.guesses ?? []);
  const [gaveUp, setGaveUp] = useState(false);
  const [query, setQuery] = useState("");
  const solved = guesses.includes(answer.id);
  const over = solved || gaveUp;
  const wrong = guesses.filter((g) => g !== answer.id).length;
  const byId = new Map(pool.map((i) => [i.id, i]));

  function guess(id: number) {
    if (over || guesses.includes(id)) return;
    const next = [...guesses, id];
    setGuesses(next);
    setQuery("");
    if (play === "daily") saveRecord({ day: today, mode: "item", guesses: next, solved: next.includes(answer.id) });
  }

  const needle = query.trim().toLocaleLowerCase(lang);
  const suggestions = needle
    ? pool
        .filter((i) => !guesses.includes(i.id) && i.name.toLocaleLowerCase(lang).includes(needle))
        .sort((a, b) => Number(!a.name.toLocaleLowerCase(lang).startsWith(needle)) - Number(!b.name.toLocaleLowerCase(lang).startsWith(needle)) || a.name.localeCompare(b.name, lang))
        .slice(0, 6)
    : [];
  const blur = over ? 0 : itemBlur(wrong);

  return (
    <div className="quiz__game">
      <div className="quiz__ability">
        <img
          src={itemIconUrl(version, answer.id)}
          alt={t("Tahmin edilecek eşya")}
          width={96}
          height={96}
          style={{ filter: `blur(${blur}px)${!over && wrong < 2 ? " grayscale(1)" : ""}` }}
        />
        <p className="build__note quiz__hint">
          {over || wrong >= PRICE_HINT_AFTER ? t("Fiyatı: {gold} altın", { gold: answer.gold.toLocaleString(lang === "tr" ? "tr" : "en-GB") }) : t("{count} yanlıştan sonra fiyatı açılır.", { count: PRICE_HINT_AFTER })}
          {!over && wrong >= LETTER_HINT_AFTER && `. ${t("İlk harfi: {letter}", { letter: answer.name[0] })}`}
        </p>
      </div>

      {over ? (
        <div className="quiz__result" role="status">
          <img src={itemIconUrl(version, answer.id)} alt="" width={56} height={56} />
          <div>
            <p className="quiz__answer">{solved ? t("Bildin: {champion}", { champion: answer.name }) : t("Cevap: {champion}", { champion: answer.name })}</p>
            <p className="build__note">
              {solved ? t("{count} tahminde", { count: guesses.length }) : t("Pes ettin.")}
              {play === "daily" && solved && `. ${t("Seri: {days} gün", { days: streak(records, "item", today) })}`}
            </p>
          </div>
          <Button
            onClick={() => {
              const head = t("Vizier bilmecesi, {mode}, {day}: {count} tahmin", { mode: t("Eşya"), day: play === "daily" ? today : t("Serbest"), count: solved ? guesses.length : "X" });
              navigator.clipboard.writeText(`${head}\n${guesses.map((id) => (id === answer.id ? "🟩" : "🟥")).join("")}`).then(
                () => toast("success", t("Sonuç panoya kopyalandı")),
                () => toast("error", t("Panoya kopyalanamadı.")),
              );
            }}
          >
            {t("Sonucu kopyala")}
          </Button>
          {play === "free" ? (
            <Button variant="primary" onClick={onNext}>
              {t("Yeni tur")}
            </Button>
          ) : (
            <p className="build__note">{t("Yeni bilmece yarın. Serbest modda oynamaya devam edebilirsin.")}</p>
          )}
        </div>
      ) : (
        <form
          className="quiz__guess"
          onSubmit={(e) => {
            e.preventDefault();
            if (suggestions[0]) guess(suggestions[0].id);
          }}
        >
          <input className="text-input quiz__input" aria-label={t("Eşya tahmin et")} placeholder={t("Eşya adı yaz")} value={query} autoFocus onChange={(e) => setQuery(e.target.value)} />
          {suggestions.length > 0 && (
            <ul className="quiz__suggestions" aria-label={t("Öneriler")}>
              {suggestions.map((i) => (
                <li key={i.id}>
                  <button type="button" onClick={() => guess(i.id)}>
                    <img src={itemIconUrl(version, i.id)} alt="" width={28} height={28} />
                    {i.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {play === "free" && guesses.length > 0 && (
            <Button variant="ghost" onClick={() => setGaveUp(true)}>
              {t("Pes et")}
            </Button>
          )}
        </form>
      )}

      <ul className="quiz__guesses" aria-label={t("Tahminlerin")}>
        {[...guesses].reverse().map((id) => {
          const item = byId.get(id);
          return item ? (
            <li key={id} data-match={id === answer.id ? "yes" : "no"}>
              <img src={itemIconUrl(version, id)} alt="" width={32} height={32} />
              {item.name}
            </li>
          ) : null;
        })}
      </ul>
    </div>
  );
}
