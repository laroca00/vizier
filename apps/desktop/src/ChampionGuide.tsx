import { abilityIconUrl, championDetail, type Champion } from "./data/ddragon";
import { traitsOf, PHASE_TEXT } from "./data/traits";
import { useLang, useT } from "./i18n";
import { useAsync } from "./useAsync";

/** Abilities with cooldowns, from Data Dragon in the UI language. */
export function Abilities({ champion, version }: { champion: Champion; version: string }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`detail:${lang}:${champion.id}`, () => championDetail(champion.id, lang));
  if (state.status === "error") return <p className="build__note">{t("Yetenekler alınamadı.")}</p>;
  if (state.status !== "done") return <p className="build__note">{t("Yükleniyor")}</p>;
  return (
    <ul className="abilities">
      {state.value.abilities.map((a) => (
        <li key={a.key}>
          <img src={abilityIconUrl(version, a.image)} alt="" width={40} height={40} loading="lazy" />
          <p className="abilities__name">
            <span className="abilities__key">{a.key === "P" ? t("Pasif") : a.key}</span>
            {a.name}
            {a.cooldowns.length > 0 && (
              <span className="matchups__games">
                {" "}
                {t("{seconds} sn bekleme", { seconds: [...new Set(a.cooldowns)].join("/") })}
              </span>
            )}
          </p>
          <p className="abilities__text">{a.description}</p>
        </li>
      ))}
    </ul>
  );
}

const STRENGTHS: { test: (tr: ReturnType<typeof traitsOf>) => boolean; text: string }[] = [
  { test: (tr) => tr.engage, text: "Savaşı kendisi başlatabilir." },
  { test: (tr) => tr.poke, text: "Uzaktan yıpratarak savaş öncesi avantaj sağlar." },
  { test: (tr) => tr.peel, text: "Takım arkadaşlarını korumada iyidir." },
  { test: (tr) => tr.disengage, text: "Rakibin dalışını bozup geri çekilmeyi sağlar." },
  { test: (tr) => tr.tank, text: "Ön hatta hasar karşılayabilir." },
];

/**
 * Strengths and weaknesses: Riot's own ally and enemy tips when Data Dragon
 * has them, plus Vizier's reading of the champion's role in a team.
 */
export function StrengthsWeaknesses({ champion }: { champion: Champion }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`detail:${lang}:${champion.id}`, () => championDetail(champion.id, lang));
  const traits = traitsOf(champion);
  const strengths = STRENGTHS.filter((s) => s.test(traits)).map((s) => t(s.text));
  strengths.push(t("{phase} döneminde güçlüdür.", { phase: t(PHASE_TEXT[traits.phase]) }));
  const tips = state.status === "done" ? state.value : null;
  return (
    <div className="champion__guide">
      <h2 className="draft__heading">{t("Güçlü yanları")}</h2>
      <ul className="comp__traits">
        {strengths.map((s) => (
          <li key={s} data-strong>
            {s}
          </li>
        ))}
      </ul>
      {tips && tips.allyTips.length > 0 && (
        <>
          <h2 className="draft__heading">{t("Oynarken")}</h2>
          <ul className="advice">
            {tips.allyTips.map((tip) => (
              <li key={tip}>
                <p>{tip}</p>
              </li>
            ))}
          </ul>
        </>
      )}
      {tips && tips.enemyTips.length > 0 && (
        <>
          <h2 className="draft__heading">{t("Ona karşı oynarken")}</h2>
          <ul className="advice">
            {tips.enemyTips.map((tip) => (
              <li key={tip}>
                <p>{tip}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** Riot's tips for playing against each enemy pick, for champ select. */
export function EnemyTips({ enemies }: { enemies: Champion[] }) {
  const t = useT();
  const lang = useLang();
  const key = enemies.map((c) => c.id).join(",");
  const [state] = useAsync(key ? `tips:${lang}:${key}` : null, () =>
    Promise.all(enemies.map((c) => championDetail(c.id, lang).then((d) => ({ champion: c, tips: d.enemyTips })).catch(() => null))),
  );
  if (state.status !== "done") return null;
  const withTips = state.value.filter((x) => x && x.tips.length > 0) as { champion: Champion; tips: string[] }[];
  if (withTips.length === 0) return null;
  return (
    <>
      <h2 className="draft__heading">{t("Rakip şampiyonlara karşı")}</h2>
      <ul className="advice">
        {withTips.map(({ champion, tips }) => (
          <li key={champion.id}>
            <p>{champion.name}</p>
            <p>{tips[0]}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
