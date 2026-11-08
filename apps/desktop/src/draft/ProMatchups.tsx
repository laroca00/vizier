import { getProBuilds, type ProBuild } from "../api";
import { championIconUrl, itemIconUrl, runeIconUrl } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { timeAgo } from "../labels";
import { maxOrderOf } from "../library/convert";
import { loadProStatic, parseRunes, type ProStatic } from "../ProBuildList";
import { useAsync } from "../useAsync";
import { rankProBuilds, type ProMatch } from "./logic";

const SHOWN = 3;
const SKILL_KEYS = ["", "Q", "W", "E", "R"];

const MATCH_TAGS: Partial<Record<ProMatch, string>> = {
  exact: "Aynı rakip",
  class: "Benzer rakip",
  damage: "Aynı hasar tipi",
};

type Props = { championId: number; position: string | null; opponentId: number | null };

/**
 * Pro players' builds for this champion and role, against our lane opponent
 * when they have played it and against the closest kind of opponent when not.
 */
export function ProMatchups({ championId, position, opponentId }: Props) {
  const t = useT();
  const role = position ? position.toUpperCase() : undefined;
  const [builds] = useAsync(`pro-matchups:${championId}:${role ?? ""}`, () => getProBuilds({ championId, position: role, limit: 100 }));
  const [data] = useAsync("pro-static", loadProStatic);

  if (builds.status === "error" || data.status === "error") return null;
  if (builds.status !== "done" || data.status !== "done") return <p className="build__note">{t("Pro maçları yükleniyor")}</p>;
  if (builds.value.length === 0) return <p className="build__note">{t("Pro oyuncuların bu şampiyonla bu rolde son maçı yok.")}</p>;

  const ranked = rankProBuilds(builds.value, opponentId, data.value.champions).slice(0, SHOWN);
  const opponent = opponentId ? data.value.champions.get(opponentId) : undefined;
  const exact = ranked.filter((r) => r.match === "exact").length;
  const note = !opponent
    ? t("Koridor rakibi belli değil; en yeni pro maçları gösteriliyor.")
    : exact > 0
      ? t("{opponent} karşısında oynanmış pro maçları önce gösteriliyor.", { opponent: opponent.name })
      : t("{opponent} karşısında pro maçı yok; ona benzeyen rakiplere karşı oynananlar gösteriliyor.", { opponent: opponent.name });

  return (
    <section className="pro-matchups" aria-label={t("Pro build'leri")}>
      <h3 className="pro-matchups__title">{t("Pro build'leri")}</h3>
      <p className="build__note">{note}</p>
      <ul className="pro-matchups__list">
        {ranked.map(({ build, match }) => (
          <ProCard key={`${build.matchId}-${build.player}`} build={build} match={match} data={data.value} />
        ))}
      </ul>
    </section>
  );
}

function ProCard({ build, match, data }: { build: ProBuild; match: ProMatch; data: ProStatic }) {
  const t = useT();
  const lang = useLang();
  const opponent = build.opponentChampionId ? data.champions.get(build.opponentChampionId) : undefined;
  const keystone = data.runes.get(parseRunes(build.runes).selectedPerkIds[0]);
  const finished = build.items.filter((id) => data.items.get(id)?.complete);
  const order = build.skillOrder.length >= 9 ? maxOrderOf(build.skillOrder) : null;
  const tag = MATCH_TAGS[match];

  return (
    <li className="pro-card" data-result={build.win ? "win" : "loss"} data-match={match}>
      <p className="pro-card__who">
        <span className="pro-card__player">{build.player}</span>
        {build.team && <span className="pro-card__team">{build.team}</span>}
      </p>
      <p className="pro-card__vs">
        {opponent ? (
          <>
            <img src={championIconUrl(data.version, opponent.id)} alt="" width={22} height={22} />
            <span>{t("{opponent} karşısında", { opponent: opponent.name })}</span>
          </>
        ) : (
          <span>{t("Rakip bilinmiyor")}</span>
        )}
        {tag && <span className="pro-card__tag">{t(tag)}</span>}
      </p>
      <div className="pro-card__build">
        {keystone && <img src={runeIconUrl(keystone.icon)} alt={keystone.name} title={keystone.name} width={26} height={26} className="pro-card__keystone" />}
        {finished.slice(0, 6).map((id, i) => {
          const item = data.items.get(id);
          return <img key={`${id}-${i}`} src={itemIconUrl(data.version, id)} alt={item?.name ?? ""} title={item?.name} width={24} height={24} />;
        })}
      </div>
      <p className="pro-card__meta">
        <span data-result={build.win ? "win" : "loss"}>{build.win ? t("Kazandı") : t("Kaybetti")}</span>
        <span>
          {build.kills}/{build.deaths}/{build.assists}
        </span>
        {order && <span>{order.map((s) => SKILL_KEYS[s]).join(" > ")}</span>}
        <span>{timeAgo(build.gameStart + build.duration * 1000, lang)}</span>
      </p>
    </li>
  );
}
