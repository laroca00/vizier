import { abilityIconUrl, championDetail, latestVersion, type Champion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { SPIKE_TEXT, threatOf } from "./threats";

/** The one ability to respect on each enemy, with its cooldown and when they get strong. */
export function ThreatsPanel({ enemies, title }: { enemies: Champion[]; title?: string }) {
  const t = useT();
  const lang = useLang();
  const key = enemies.map((c) => c.id).join(",");
  const [state] = useAsync(key ? `threats:${lang}:${key}` : null, async () => {
    const version = await latestVersion();
    const rows = await Promise.all(
      enemies.map((c) =>
        championDetail(c.id, lang)
          .then((d) => threatOf(c, d.abilities))
          .catch(() => null),
      ),
    );
    return { version, threats: rows.filter((r) => r !== null) };
  });
  if (state.status !== "done" || state.value.threats.length === 0) return null;
  return (
    <>
      <h2 className="draft__heading">{title ?? t("Rakip tehditleri")}</h2>
      <ul className="advice threats">
        {state.value.threats.map((th) => (
          <li key={th.championId}>
            <p>
              <img src={abilityIconUrl(state.value.version, th.ability.image)} alt="" width={22} height={22} /> {th.name} · {th.ability.key} · {th.ability.name}
            </p>
            <p>
              {th.cooldown
                ? t("Bekleme: 1. seviyede {first} sn, son seviyede {max} sn", { first: th.cooldown.first, max: th.cooldown.max })
                : t("Bekleme süresi yok")}
              {" · "}
              {t(SPIKE_TEXT[th.spike])}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
