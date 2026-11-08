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

const STAT_ROWS: { label: string; base: string; perLevel?: string; format?: (n: number) => string }[] = [
  { label: "Can", base: "hp", perLevel: "hpperlevel" },
  { label: "Can yenilenmesi", base: "hpregen", perLevel: "hpregenperlevel" },
  { label: "Kaynak", base: "mp", perLevel: "mpperlevel" },
  { label: "Saldırı gücü", base: "attackdamage", perLevel: "attackdamageperlevel" },
  { label: "Saldırı hızı", base: "attackspeed", perLevel: "attackspeedperlevel", format: (n) => n.toFixed(3) },
  { label: "Zırh", base: "armor", perLevel: "armorperlevel" },
  { label: "Büyü direnci", base: "spellblock", perLevel: "spellblockperlevel" },
  { label: "Saldırı menzili", base: "attackrange" },
  { label: "Hareket hızı", base: "movespeed" },
];

const trim = (n: number) => String(Math.round(n * 100) / 100);

/** Title, lore and level-one stats from Data Dragon, with growth per level. */
export function ChampionReference({ champion }: { champion: Champion }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`detail:${lang}:${champion.id}`, () => championDetail(champion.id, lang));
  if (state.status !== "done") return null;
  const { lore, stats, resource } = state.value;
  const rows = STAT_ROWS.filter((row) => (stats[row.base] ?? 0) > 0);
  return (
    <div className="champion__lore-stats">
      {lore && (
        <section aria-label={t("Hikaye")}>
          <h2 className="draft__heading">{t("Hikaye")}</h2>
          <p className="champion__lore">{lore}</p>
        </section>
      )}
      <section aria-label={t("Temel değerler")}>
        <h2 className="draft__heading">{t("Temel değerler")}</h2>
        <table className="base-stats">
          <tbody>
            {rows.map((row) => {
              const format = row.format ?? trim;
              const growth = row.perLevel ? (stats[row.perLevel] ?? 0) : 0;
              return (
                <tr key={row.base}>
                  <th scope="row">{row.base === "mp" && resource ? resource : t(row.label)}</th>
                  <td>{format(stats[row.base])}</td>
                  <td className="base-stats__growth">{growth ? t("seviye başına +{value}", { value: row.base === "attackspeed" ? `${trim(growth)}%` : trim(growth) }) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export const CLASS_NAMES: Record<string, string> = {
  Assassin: "Suikastçı",
  Fighter: "Dövüşçü",
  Mage: "Büyücü",
  Marksman: "Nişancı",
  Support: "Destek",
  Tank: "Tank",
};

const difficultyName = (d: number) => (d <= 3 ? "Kolay" : d <= 7 ? "Orta" : "Zor");

/** "the Nine-Tailed Fox", then Data Dragon's classes and difficulty, in the UI language. */
export function ChampionTitle({ champion }: { champion: Champion }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`detail:${lang}:${champion.id}`, () => championDetail(champion.id, lang));
  const facts = [...champion.tags.map((tag) => t(CLASS_NAMES[tag] ?? tag)), t("zorluk: {level}", { level: t(difficultyName(champion.info.difficulty)).toLocaleLowerCase(lang) })];
  return (
    <p className="champion__title">
      {state.status === "done" && state.value.title ? `${state.value.title}. ` : ""}
      {facts.join(", ")}
    </p>
  );
}
