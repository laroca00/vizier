import { championIconUrl, type Champion } from "../data/ddragon";
import { favouriteTarget, filterFavourites, FAV_KIND_TEXT, type Favourite } from "../favourites";
import { useLang, useT } from "../i18n";
import { useLibrary } from "../library/store";
import { usePersonal } from "../personal";
import type { Route } from "../router";
import { useSavedDrafts } from "../simulator/store";
import { NavIcon, type IconName } from "../ui/NavIcon";

type Props = { version: string | null; champions: Map<number, Champion>; onOpenChampion: (id: number, position: string | null) => void; onNavigate: (route: Route) => void };

const SHOWN = 3;

/** What the player was last working on: matchups, builds and drafts, newest first. Nothing here is measured, only reopened. */
export function ResumeCard({ version, champions, onNavigate }: Omit<Props, "onOpenChampion">) {
  const t = useT();
  const { recentMatchups } = usePersonal();
  const { builds } = useLibrary();
  const drafts = useSavedDrafts();
  const latestBuilds = [...builds].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, SHOWN);
  const latestDrafts = [...drafts].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, SHOWN);
  const matchups = recentMatchups.filter((m) => champions.has(m.championId) && champions.has(m.opponentId)).slice(0, SHOWN);
  const empty = matchups.length + latestBuilds.length + latestDrafts.length === 0;
  const icon = (id: number) => {
    const champion = champions.get(id);
    return champion && version ? <img src={championIconUrl(version, champion.id)} alt="" width={24} height={24} loading="lazy" /> : null;
  };
  return (
    <section className="home__card enter" aria-labelledby="home-resume">
      <h2 id="home-resume" className="section-title">{t("Kaldığın yerden devam et")}</h2>
      {empty ? (
        <p className="state__text">{t("Açtığın eşleşme, build ve draft'lar burada görünür.")}</p>
      ) : (
        <div className="home__resume">
          {matchups.length > 0 && (
            <ul aria-label={t("Eşleşmeler")}>
              {matchups.map((m) => (
                <li key={`${m.championId}:${m.opponentId}`}>
                  <button type="button" className="home__row" onClick={() => onNavigate({ page: "matchup", championId: m.championId, opponentId: m.opponentId, position: m.position })}>
                    {icon(m.championId)}
                    <span>{t("{a} - {b}", { a: champions.get(m.championId)!.name, b: champions.get(m.opponentId)!.name })}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {latestBuilds.length > 0 && (
            <ul aria-label={t("Build'ler")}>
              {latestBuilds.map((b) => (
                <li key={b.id}>
                  <button type="button" className="home__row" onClick={() => onNavigate({ page: "builds", buildId: b.id })}>
                    {icon(b.championId)}
                    <span>{b.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {latestDrafts.length > 0 && (
            <ul aria-label={t("Draft şablonları")}>
              {latestDrafts.map((d) => (
                <li key={d.id}>
                  <button type="button" className="home__row" onClick={() => onNavigate({ page: "simulator" })}>
                    <NavIcon name="simulator" size={20} />
                    <span>{d.name || t("Adsız draft")}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

/** The most recently used favourites, templates first since they are what a player reaches for before a game. */
export function FavouritesCard({ onOpenChampion, onNavigate }: Pick<Props, "onOpenChampion" | "onNavigate">) {
  const t = useT();
  const lang = useLang();
  const { favs } = usePersonal();
  const sorted = filterFavourites(favs, {}, lang);
  const templates = sorted.filter((f) => f.kind === "comp" || f.kind === "draft");
  const rest = sorted.filter((f) => f.kind !== "comp" && f.kind !== "draft");
  const shown = [...templates.slice(0, 2), ...rest].slice(0, 6);
  function open(f: Favourite) {
    const target = favouriteTarget(f);
    if (!target) return;
    if ("champion" in target) onOpenChampion(target.champion, null);
    else onNavigate(target.route);
  }
  return (
    <section className="home__card enter" aria-labelledby="home-favs">
      <h2 id="home-favs" className="section-title">{t("Favorilerin")}</h2>
      {shown.length === 0 ? (
        <p className="state__text">{t("Kombo, build, eşleşme ve şablonlardaki yıldızla eklediklerin burada görünür.")}</p>
      ) : (
        <ul>
          {shown.map((f) => (
            <li key={`${f.kind}${f.id}`}>
              <button type="button" className="home__row" onClick={() => open(f)}>
                <span>{f.label}</span>
                <span className="build__stat">{t(FAV_KIND_TEXT[f.kind])}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="link" onClick={() => onNavigate({ page: "favourites" })}>{t("Hepsini gör")}</button>
    </section>
  );
}

const LINKS: { icon: IconName; title: string; route: Route }[] = [
  { icon: "lab", title: "Eşya laboratuvarı", route: { page: "lab", championId: null, position: "MIDDLE" } },
  { icon: "simulator", title: "Draft simülatörü", route: { page: "simulator" } },
  { icon: "matchup", title: "Eşleşme çalışması", route: { page: "matchup", championId: null, opponentId: null, position: "MIDDLE" } },
  { icon: "matchup", title: "Karşı seçim matrisi", route: { page: "matrix", position: "MIDDLE" } },
  { icon: "archetypes", title: "Sinerji gezgini", route: { page: "synergy", championId: null, position: "MIDDLE" } },
];

export function QuickLinksCard({ onNavigate }: Pick<Props, "onNavigate">) {
  const t = useT();
  return (
    <section className="home__card enter" aria-labelledby="home-links">
      <h2 id="home-links" className="section-title">{t("Hızlı bağlantılar")}</h2>
      <ul className="home__links">
        {LINKS.map((link) => (
          <li key={link.title}>
            <button type="button" className="home__row" onClick={() => onNavigate(link.route)}>
              <NavIcon name={link.icon} size={20} />
              <span>{t(link.title)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
