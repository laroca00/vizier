import { useState, type CSSProperties } from "react";
import { abilityIconUrl, championDetail, championIconUrl, skins, splashUrl, type Champion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { EMOJI_HINTS } from "../quiz/emoji";
import {
  attributesOf,
  classicGrid,
  compareClassic,
  dailyPick,
  dayKey,
  emojisShown,
  hash,
  rangeOf,
  skinView,
  streak,
  type ClassicResult,
  type Match,
  type QuizMode,
} from "../quiz/logic";
import "../quiz/quiz.css";
import { REGION_NAMES } from "../quiz/championFacts";
import { recordFor, saveRecord, useQuizRecords } from "../quiz/store";
import { Button } from "../ui/Button";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { ErrorState, Skeleton } from "../ui/States";
import { Tabs } from "../ui/Tabs";
import { useAsync } from "../useAsync";
import { useToast } from "../ui/Toast";
import { ItemGame } from "../quiz/ItemGame";
import { loadChampionRoles, type ChampionRoles } from "./ChampionsPage";

const MODE_LABELS: Record<QuizMode, { label: string; hint: string }> = {
  classic: { label: "Klasik", hint: "Her tahmin; bölge, kaynak, menzil, çıkış yılı ve rollerde ne kadar yaklaştığını gösterir." },
  ability: { label: "Yetenek", hint: "Bu yetenek kimin? Yanlış tahminlerde ikon renklenir, sonra tuşu ve adı açılır." },
  emoji: { label: "Emoji", hint: "Her yanlış tahminde bir emoji daha açılır." },
  skin: { label: "Kostüm", hint: "Bir kostüm görselinin yakın planı. Her yanlış tahminde görüntü uzaklaşır." },
  item: { label: "Eşya", hint: "Bulanık bir eşya ikonu. Her yanlış tahminde netleşir; sonra fiyatı ve ilk harfi açılır." },
};

type Play = "daily" | "free";

export function QuizPage() {
  const t = useT();
  const [mode, setMode] = useState<QuizMode>("classic");
  const [play, setPlay] = useState<Play>("daily");
  const [round, setRound] = useState(0);
  const [data, retry] = useAsync("champion-roles", loadChampionRoles);

  return (
    <LiquidGlass className="panel tiers quiz" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Şampiyon bilmecesi")}
        subtitle={t(MODE_LABELS[mode].hint)}
        toolbar={
          <Tabs
            label={t("Oyun")}
            items={[
              { id: "daily" as Play, label: t("Günün bilmecesi") },
              { id: "free" as Play, label: t("Serbest") },
            ]}
            value={play}
            onChange={setPlay}
          />
        }
      />
      <Tabs label={t("Mod")} size="small" items={(Object.keys(MODE_LABELS) as QuizMode[]).map((m) => ({ id: m, label: t(MODE_LABELS[m].label) }))} value={mode} onChange={setMode} />
      {data.status === "error" ? (
        <ErrorState message={t("Oyun verisi alınamadı.")} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={5} label={t("Yükleniyor")} />
      ) : (
        mode === "item" ? (
          <ItemGame key={`item:${play}:${round}`} play={play} onNext={() => setRound(round + 1)} />
        ) : (
          <Game key={`${mode}:${play}:${round}`} mode={mode} play={play} data={data.value} onNext={() => setRound(round + 1)} />
        )
      )}
    </LiquidGlass>
  );
}

function pool(mode: QuizMode, data: ChampionRoles): Champion[] {
  const all = [...data.champions.values()].sort((a, b) => a.key - b.key);
  return mode === "emoji" ? all.filter((c) => EMOJI_HINTS[c.id]) : all;
}

const rolesOf = (data: ChampionRoles, key: number) =>
  [...(data.roles.get(key)?.entries() ?? [])].sort((a, b) => b[1].games - a[1].games).map(([role]) => role);

function Game({ mode, play, data, onNext }: { mode: QuizMode; play: Play; data: ChampionRoles; onNext: () => void }) {
  const t = useT();
  const lang = useLang();
  const records = useQuizRecords();
  const toast = useToast();
  const today = dayKey(new Date());
  const candidates = pool(mode, data);
  const [freeSeed] = useState(() => Math.floor(Math.random() * 1e9));
  const answer = play === "daily" ? dailyPick(candidates, today, mode) : candidates[freeSeed % candidates.length];
  const saved = play === "daily" ? recordFor(records, today, mode) : undefined;
  const [guesses, setGuesses] = useState<number[]>(saved?.guesses ?? []);
  const [gaveUp, setGaveUp] = useState(false);
  const [query, setQuery] = useState("");
  const solved = guesses.includes(answer.key);
  const over = solved || gaveUp;
  const wrong = guesses.filter((g) => g !== answer.key).length;

  function guess(championId: number) {
    if (over || guesses.includes(championId)) return;
    const next = [...guesses, championId];
    setGuesses(next);
    setQuery("");
    if (play === "daily") saveRecord({ day: today, mode, guesses: next, solved: next.includes(answer.key) });
  }

  const needle = query.trim().toLocaleLowerCase(lang);
  const suggestions = needle
    ? [...data.champions.values()]
        .filter((c) => !guesses.includes(c.key) && c.name.toLocaleLowerCase(lang).startsWith(needle))
        .sort((a, b) => a.name.localeCompare(b.name, lang))
        .slice(0, 6)
    : [];

  return (
    <div className="quiz__game">
      <Clue mode={mode} answer={answer} wrong={wrong} over={over} data={data} seed={play === "daily" ? hash(today) : freeSeed} />

      {over ? (
        <div className="quiz__result" role="status" data-solved={solved || undefined}>
          <img src={championIconUrl(data.version, answer.id)} alt="" width={56} height={56} />
          <div>
            <p className="quiz__answer">{solved ? t("Bildin: {champion}", { champion: answer.name }) : t("Cevap: {champion}", { champion: answer.name })}</p>
            <p className="build__note">
              {solved ? t("{count} tahminde", { count: guesses.length }) : t("Pes ettin.")}
              {play === "daily" && solved && `. ${t("Seri: {days} gün", { days: streak(records, mode, today) })}`}
            </p>
          </div>
          <Button
            onClick={() => {
              const head = t("Vizier bilmecesi, {mode}, {day}: {count} tahmin", { mode: t(MODE_LABELS[mode].label), day: play === "daily" ? today : t("Serbest"), count: solved ? guesses.length : "X" });
              const target = attributesOf(answer, rolesOf(data, answer.key));
              const grid =
                mode === "classic"
                  ? classicGrid(guesses.map((id) => compareClassic(attributesOf(data.champions.get(id)!, rolesOf(data, id)), target)))
                  : guesses.map((id) => (id === answer.key ? "🟩" : "🟥")).join("");
              navigator.clipboard.writeText(`${head}\n${grid}`).then(
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
            if (suggestions[0]) guess(suggestions[0].key);
          }}
        >
          <input
            className="text-input quiz__input"
            aria-label={t("Şampiyon tahmin et")}
            placeholder={t("Şampiyon adı yaz")}
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          {suggestions.length > 0 && (
            <ul className="quiz__suggestions" aria-label={t("Öneriler")}>
              {suggestions.map((c) => (
                <li key={c.key}>
                  <button type="button" onClick={() => guess(c.key)}>
                    <img src={championIconUrl(data.version, c.id)} alt="" width={28} height={28} />
                    {c.name}
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

      {mode === "classic" ? (
        <ClassicTable guesses={guesses} answer={answer} data={data} />
      ) : (
        <ul className="quiz__guesses" aria-label={t("Tahminlerin")}>
          {[...guesses].reverse().map((id) => {
            const c = data.champions.get(id)!;
            return (
              <li key={id} data-match={id === answer.key ? "yes" : "no"}>
                <img src={championIconUrl(data.version, c.id)} alt="" width={32} height={32} />
                {c.name}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Clue({ mode, answer, wrong, over, data, seed }: { mode: QuizMode; answer: Champion; wrong: number; over: boolean; data: ChampionRoles; seed: number }) {
  const t = useT();
  const lang = useLang();
  const titleHint = mode === "classic" && !over && wrong >= TITLE_HINT_AFTER;
  const [detail] = useAsync(mode === "ability" || titleHint ? `detail:${lang}:${answer.id}` : null, () => championDetail(answer.id, lang));
  const [skinList] = useAsync(mode === "skin" ? `skins:${answer.id}` : null, () => skins(answer.id));

  if (mode === "emoji") {
    const hints = EMOJI_HINTS[answer.id] ?? [];
    const shown = over ? hints.length : emojisShown(wrong, hints.length);
    return (
      <p className="quiz__emoji" aria-label={t("Emoji ipuçları")}>
        {hints.map((e, i) => (
          // A new key when the emoji shows, so it turns over into view.
          <span key={`${i}:${i < shown}`} data-hidden={i >= shown || undefined}>
            {i < shown ? e : "?"}
          </span>
        ))}
      </p>
    );
  }

  if (mode === "ability") {
    if (detail.status !== "done") return <Skeleton lines={2} label={t("Yükleniyor")} />;
    const ability = detail.value.abilities[seed % detail.value.abilities.length];
    return (
      <div className="quiz__ability">
        <img src={abilityIconUrl(data.version, ability.image)} alt={t("Tahmin edilecek yetenek")} width={96} height={96} data-grey={(!over && wrong < 2) || undefined} />
        <p className="build__note">
          {over || wrong >= 3 ? t("Tuş: {key}", { key: ability.key === "P" ? t("Pasif") : ability.key }) : t("3 yanlıştan sonra tuşu açılır")}
          {(over || wrong >= 5) && `. ${ability.name}`}
        </p>
      </div>
    );
  }

  if (mode === "skin") {
    if (skinList.status !== "done") return <Skeleton lines={3} label={t("Yükleniyor")} />;
    const skin = skinList.value[seed % skinList.value.length];
    const view = over ? { zoom: 1, radius: 100 } : skinView(wrong);
    // A spot in the middle of the art, where the champion usually is.
    const x = 30 + (seed % 41);
    const y = 25 + ((seed >> 8) % 41);
    return (
      <figure className="quiz__skin">
        <div className="quiz__skin-frame">
          <div
            role="img"
            aria-label={t("Bir kostüm görselinden kesit")}
            style={{
              backgroundImage: `url(${splashUrl(answer.id, skin.num)})`,
              backgroundSize: `${view.zoom * 100}%`,
              backgroundPosition: `${x}% ${y}%`,
              // The window sits on the same spot the zoom centres, so it shows the focus point.
              clipPath: view.radius >= 100 ? "none" : `circle(${view.radius}% at ${x}% ${y}%)`,
            }}
          />
        </div>
        {over && <figcaption className="build__note">{skin.name === "default" ? answer.name : skin.name}</figcaption>}
      </figure>
    );
  }

  if (mode === "classic") {
    if (over) return null;
    return (
      <p className="build__note quiz__hint">
        {titleHint && detail.status === "done"
          ? t("İpucu: unvanı \"{title}\"", { title: detail.value.title })
          : t("{count} yanlış tahminden sonra şampiyonun unvanı ipucu olarak açılır.", { count: TITLE_HINT_AFTER })}
      </p>
    );
  }

  return null;
}

// Wrong classic guesses before the champion's title shows as a hint.
const TITLE_HINT_AFTER = 5;

const MATCH_LABEL: Record<Match, string> = { yes: "Doğru", partial: "Kısmen", no: "Yanlış" };

const COLUMNS = ["Bölge", "Kaynak", "Menzil", "Çıkış yılı", "Roller"];

/** Rows of tiles, newest on top; a new row's tiles turn over one after another. */
function ClassicTable({ guesses, answer, data }: { guesses: number[]; answer: Champion; data: ChampionRoles }) {
  const t = useT();
  if (guesses.length === 0) return <p className="build__note">{t("Bir şampiyon yazıp tahmin et. Renkler doğru, kısmen doğru ve yanlış olanları gösterir.")}</p>;
  const target = attributesOf(answer, rolesOf(data, answer.key));
  const tile = (i: number, match: Match, text: string, arrow?: ClassicResult["yearArrow"]) => (
    <div role="cell" className="quiz__tile" data-match={match} style={{ "--i": i } as CSSProperties} title={t(MATCH_LABEL[match])}>
      <span>{text}</span>
      {arrow && (
        <span className="quiz__arrow" aria-hidden="true">
          {arrow === "higher" ? "↑" : "↓"}
        </span>
      )}
      <span className="visually-hidden">
        {", "}
        {t(MATCH_LABEL[match])}
        {arrow ? `, ${arrow === "higher" ? t("cevap daha yeni") : t("cevap daha eski")}` : ""}
      </span>
    </div>
  );
  return (
    <div className="quiz__board" role="table" aria-label={t("Tahminlerin")}>
      <div role="row" className="quiz__board-head">
        <span role="columnheader">{t("Şampiyon")}</span>
        {COLUMNS.map((c) => (
          <span key={c} role="columnheader">
            {t(c)}
          </span>
        ))}
      </div>
      {[...guesses].reverse().map((id) => {
        const c = data.champions.get(id)!;
        const mine = attributesOf(c, rolesOf(data, id));
        const r = compareClassic(mine, target);
        return (
          <div role="row" key={id} className="quiz__board-row">
            <div role="rowheader" className="quiz__tile quiz__tile--champion" data-match={id === answer.key ? "yes" : undefined}>
              <img src={championIconUrl(data.version, c.id)} alt="" width={44} height={44} />
              <span>{c.name}</span>
            </div>
            {tile(1, r.region, mine.region ? t(REGION_NAMES[mine.region]) : "–")}
            {tile(2, r.resource, mine.resource)}
            {tile(3, r.range, rangeOf(c) === "ranged" ? t("Uzak") : t("Yakın"))}
            {tile(4, r.year, mine.year ? String(mine.year) : "–", r.yearArrow)}
            {tile(5, r.roles, mine.roles.map((role) => t(POSITIONS[role] ?? role)).join(", ") || "–")}
          </div>
        );
      })}
    </div>
  );
}
