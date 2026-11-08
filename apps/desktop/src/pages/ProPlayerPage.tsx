import { getProBuilds } from "../api";
import { championIconUrl, itemIconUrl, runeIconUrl, spellIconUrl } from "../data/ddragon";
import { useT } from "../i18n";
import { loadProStatic, parseRunes, ProBuildList } from "../ProBuildList";
import { summarizePlayer } from "../proStats";
import { toggleFollow, usePersonal } from "../personal";
import { Button } from "../ui/Button";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState } from "../ui/States";
import { useAsync } from "../useAsync";
import "./ProPlayerPage.css";

const REGIONS: Record<string, string> = { kr: "KR", euw1: "EUW", tr1: "TR", na1: "NA" };
const TOP = 5;

/** One pro: what they play, how they build it, and their latest games. */
export function ProPlayerPage({ player }: { player: string }) {
  const t = useT();
  const following = usePersonal().followed.includes(player);
  const [builds, retry] = useAsync(`pro-player:${player}`, () => getProBuilds({ player, limit: 100 }));
  const [data] = useAsync("pro-static", loadProStatic);

  if (!player) return <LiquidGlass className="panel tiers" radius={28} strength={2.5} scroll><EmptyState title={t("Bir pro oyuncu seç")} /></LiquidGlass>;
  if (builds.status === "error" || data.status === "error") {
    return (
      <LiquidGlass className="panel tiers" radius={28} strength={2.5} scroll>
        <ErrorState message={t("Pro maçları alınamadı.")} onRetry={retry} />
      </LiquidGlass>
    );
  }

  const ready = builds.status === "done" && data.status === "done";
  const summary = ready
    ? summarizePlayer(
        builds.value,
        (b) => parseRunes(b.runes).selectedPerkIds[0],
        (id) => !!data.value.items.get(id)?.complete,
      )
    : null;
  const regions = summary?.platforms.map((p) => REGIONS[p] ?? p.toUpperCase()).join(", ");

  return (
    <LiquidGlass className="panel tiers" radius={28} strength={2.5} scroll>
      <PageHeader
        title={player}
        subtitle={
          summary && summary.games > 0
            ? t("{team}, {regions}, son 30 günde {games} solo kuyruk maçı", { team: summary.team || t("Takımsız"), regions: regions ?? "", games: summary.games })
            : t("Son 30 gün")
        }
        toolbar={
          <Button variant="ghost" aria-pressed={following} onClick={() => toggleFollow(player)}>
            {following ? t("Takibi bırak") : t("Takip et")}
          </Button>
        }
      />
      {!ready && <p className="build__note">{t("Pro maçları yükleniyor")}</p>}
      {summary && summary.games === 0 && <p className="build__note">{t("Bu oyuncunun son 30 günde kayıtlı maçı yok.")}</p>}
      {summary && data.status === "done" && summary.games > 0 && (
        <div className="pro-player__stats">
          <section aria-label={t("En çok oynadığı şampiyonlar")}>
            <h2 className="section-title">{t("En çok oynadığı şampiyonlar")}</h2>
            <ul className="pro-player__list">
              {summary.champions.slice(0, TOP).map((c) => {
                const champion = data.value.champions.get(c.championId);
                return (
                  <li key={c.championId}>
                    {champion && <img src={championIconUrl(data.value.version, champion.id)} alt="" width={28} height={28} />}
                    <span>{champion?.name ?? c.championId}</span>
                    <span className="build__stat">{t("{games} maç, %{rate} kazanma", { games: c.games, rate: Math.round((c.wins / c.games) * 100) })}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section aria-label={t("Sık kullandığı rünler ve büyüler")}>
            <h2 className="section-title">{t("Sık kullandığı rünler ve büyüler")}</h2>
            <ul className="pro-player__list">
              {summary.keystones.slice(0, 3).map((k) => {
                const rune = data.value.runes.get(k.id);
                return (
                  <li key={k.id}>
                    {rune && <img src={runeIconUrl(rune.icon)} alt="" width={28} height={28} />}
                    <span>{rune?.name ?? k.id}</span>
                    <span className="build__stat">{t("{games} maç", { games: k.games })}</span>
                  </li>
                );
              })}
              {summary.spells.slice(0, 2).map((s) => {
                const spell = [...data.value.spells.values()].find((x) => x.key === s.id);
                return (
                  <li key={`s${s.id}`}>
                    {spell && <img src={spellIconUrl(data.value.version, spell.id)} alt="" width={28} height={28} />}
                    <span>{spell?.name ?? s.id}</span>
                    <span className="build__stat">{t("{games} maç", { games: s.games })}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <section aria-label={t("Sık bitirdiği eşyalar")}>
            <h2 className="section-title">{t("Sık bitirdiği eşyalar")}</h2>
            <ul className="pro-player__list">
              {summary.items.slice(0, 6).map((i) => {
                const item = data.value.items.get(i.id);
                return (
                  <li key={i.id}>
                    <img src={itemIconUrl(data.value.version, i.id)} alt="" width={28} height={28} />
                    <span>{item?.name ?? i.id}</span>
                    <span className="build__stat">{t("{games} maç", { games: i.games })}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
      <h2 className="section-title">{t("Son maçlar")}</h2>
      <ProBuildList filter={{ player, limit: 20 }} emptyText={t("Bu oyuncunun son 30 günde kayıtlı maçı yok.")} />
    </LiquidGlass>
  );
}
