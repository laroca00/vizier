import { abilityIconUrl, championDetail, summonerSpells, type Champion } from "../data/ddragon";
import { CATEGORY_TEXT, type Combo } from "../data/combos";
import { useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { useAsync } from "../useAsync";
import "./combos.css";

const SPELL_KEYS: Record<string, number> = { Flash: 4, Ignite: 14, Ghost: 6, Smite: 11 };

/** The sequence as ability icons joined by arrows, drawn from Data Dragon's own icons. */
function Sequence({ champion, version, sequence }: { champion: Champion; version: string; sequence: string[] }) {
  const lang = useLang();
  const [detail] = useAsync(`detail:${lang}:${champion.id}`, () => championDetail(champion.id, lang));
  const [spells] = useAsync("summoner-spells", summonerSpells);
  return (
    <ol className="combo__sequence" aria-label={sequence.join(" → ")}>
      {sequence.map((token, i) => {
        const slot = token[0];
        const ability = detail.status === "done" ? detail.value.abilities.find((a) => a.key === slot) : undefined;
        const spell = token in SPELL_KEYS && spells.status === "done" ? spells.value.get(SPELL_KEYS[token]) : undefined;
        return (
          <li key={i}>
            {i > 0 && <span className="combo__arrow" aria-hidden="true">→</span>}
            <span className="combo__step" data-kind={token === "AA" ? "attack" : spell ? "spell" : "ability"}>
              {ability && /^[QWER]/.test(token) ? (
                <img src={abilityIconUrl(version, ability.image)} alt="" width={32} height={32} loading="lazy" />
              ) : spell ? (
                <img src={`https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/${spell.id}.png`} alt="" width={32} height={32} loading="lazy" />
              ) : null}
              <span className="combo__label">{token === "AA" ? "AA" : token}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ComboCard({ champion, version, combo, patch, changedIn = null }: { champion: Champion; version: string; combo: Combo; patch: string; changedIn?: string | null }) {
  const t = useT();
  const lang = useLang();
  return (
    <article className="combo">
      <header className="combo__head">
        <h3 className="combo__name">{combo.name[lang]}</h3>
        <span className="combo__chip">{t(CATEGORY_TEXT[combo.category])}</span>
        <span className="combo__chip" title={t("Zorluk")}>
          {"●".repeat(combo.difficulty)}
          {"○".repeat(3 - combo.difficulty)}
        </span>
        <DataBadge editorial source={t("Yama {patch} için elle yazıldı; sonraki yamalarda yetenekler değişmiş olabilir.", { patch })} />
      </header>
      {changedIn && <p className="build__note">{t("Yama {patch} bu kombodaki bir yeteneği değiştirdi; zamanlamayı kontrol et.", { patch: changedIn })}</p>}
      <Sequence champion={champion} version={version} sequence={combo.sequence} />
      <dl className="combo__notes">
        <div>
          <dt>{t("Amaç")}</dt>
          <dd>{combo.purpose[lang]}</dd>
        </div>
        <div>
          <dt>{t("Zamanlama")}</dt>
          <dd>{combo.timing[lang]}</dd>
        </div>
        <div>
          <dt>{t("Sık yapılan hata")}</dt>
          <dd>{combo.mistake[lang]}</dd>
        </div>
      </dl>
    </article>
  );
}
