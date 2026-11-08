import { useT } from "../i18n";
import { dayKey, MODES, modeStats, type QuizMode } from "./logic";
import { useQuizRecords } from "./store";

const LABELS: Record<QuizMode, string> = { classic: "Klasik", ability: "Yetenek", emoji: "Emoji", skin: "Kostüm", item: "Eşya", recipe: "Tarif" };
const HISTORY = 14;

/** Daily riddle results kept on this computer; free play is not recorded. */
export function StatsView() {
  const t = useT();
  const records = useQuizRecords();
  const today = dayKey(new Date());
  if (records.length === 0) return <p className="build__note">{t("Henüz günün bilmecesini oynamadın. Sonuçların burada görünür.")}</p>;

  return (
    <div className="quiz__stats">
      {MODES.map((mode) => {
        const s = modeStats(records, mode, today);
        if (s.played === 0) return null;
        const peak = Math.max(1, ...s.distribution);
        const recent = records.filter((r) => r.mode === mode).slice(-HISTORY);
        return (
          <section key={mode} className="quiz__stats-mode" aria-label={t(LABELS[mode])}>
            <h3>{t(LABELS[mode])}</h3>
            <p className="build__note">
              {t("{played} oyun, {solved} bildin (%{rate})", { played: s.played, solved: s.solved, rate: Math.round((s.solved / s.played) * 100) })}
              {". "}
              {t("Seri: {days} gün", { days: s.current })}
              {". "}
              {t("En uzun seri: {days} gün", { days: s.best })}
            </p>
            <ol className="quiz__distribution" aria-label={t("Tahmin sayısı dağılımı")}>
              {s.distribution.map((n, i) => (
                <li key={i}>
                  <span>{i === s.distribution.length - 1 ? `${i + 1}+` : i + 1}</span>
                  <span className="quiz__bar" style={{ width: `${(n / peak) * 100}%` }} data-empty={n === 0 || undefined} />
                  <span>{n}</span>
                </li>
              ))}
            </ol>
            <ul className="quiz__history" aria-label={t("Son oyunlar")}>
              {recent.map((r) => (
                <li key={r.day} data-solved={r.solved || undefined} title={`${r.day}: ${r.solved ? t("{count} tahminde", { count: r.guesses.length }) : t("Çözülmedi")}`}>
                  {r.solved ? r.guesses.length : "–"}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
