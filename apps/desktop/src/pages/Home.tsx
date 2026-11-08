import { ClientStatus } from "../ClientStatus";
import { openExternal, PATCH_NOTES } from "../links";
import { champions, latestVersion, type Champion } from "../data/ddragon";
import { getChampion } from "../api";
import type { LcuStatus } from "../lcu";
import { MetaMovers } from "../MetaMovers";
import { MetaPicks } from "../MetaPicks";
import { usePersonal } from "../personal";
import { usePoolChanges } from "../patches/usePoolChanges";
import { ProBuildList } from "../ProBuildList";
import type { Route } from "../router";
import { formatPercent, useLang, useT } from "../i18n";
import { ChampionCard } from "../ui/GameIcons";
import { LiquidGlass } from "../ui/LiquidGlass";
import { NavIcon, type IconName } from "../ui/NavIcon";
import { useAsync } from "../useAsync";
import { dayKey, MODES } from "../quiz/logic";
import { useQuizRecords } from "../quiz/store";
import "./Home.css";
import { PoolPatch } from "./PoolPatch";
import { PoolMoves } from "../PoolMovesPanel";

type Props = {
  lcu: LcuStatus;
  draftActive: boolean;
  onOpenChampion: (championId: number, position: string | null) => void;
  onNavigate: (route: Route) => void;
  onSearch: () => void;
};

// Riot's own patch notes; Vizier links to them instead of copying them.
async function loadStatic() {
  const [version, byKey] = await Promise.all([latestVersion(), champions()]);
  return { version, champions: byKey };
}

export function Home({ lcu, draftActive, onOpenChampion, onNavigate, onSearch }: Props) {
  const t = useT();
  const lang = useLang();
  const personal = usePersonal();
  const [data] = useAsync("static", loadStatic);
  const summoner = lcu.state === "connected" ? lcu.summoner : null;
  const today = dayKey(new Date());
  const solvedToday = useQuizRecords().filter((r) => r.day === today && r.solved).length;
  const patch = data.status === "done" ? data.value.version.split(".").slice(0, 2).join(".") : null;

  const actions: { icon: IconName; title: string; text: string; onClick: () => void; disabled?: boolean }[] = [
    { icon: "search", title: t("Şampiyon ara"), text: t("Build, eşleşme ve pro maçları, Ctrl K"), onClick: onSearch },
    { icon: "tiers", title: t("Tier listesi"), text: t("Rol rol en güçlü şampiyonlar"), onClick: () => onNavigate({ page: "tiers" }) },
    { icon: "pros", title: t("Pro build'ler"), text: t("Worlds, Türk oyuncular ve Challenger"), onClick: () => onNavigate({ page: "pros" }) },
    { icon: "overlay", title: t("Overlay"), text: t("Oyun içi panel ve kısayollar"), onClick: () => onNavigate({ page: "overlay" }) },
    {
      icon: "quiz",
      title: t("Günün bilmecesi"),
      text: t("Bugün {solved}/{total} mod çözüldü", { solved: solvedToday, total: MODES.length }),
      onClick: () => onNavigate({ page: "quiz" }),
    },
    {
      icon: "draft",
      title: t("Şampiyon seçimi"),
      text: draftActive ? t("Seçim sürüyor, öneriler hazır") : t("Seçim başlayınca kendiliğinden açılır"),
      onClick: () => onNavigate({ page: "draft" }),
      disabled: !draftActive,
    },
  ];

  const known = (ids: number[]) => (data.status === "done" ? ids.flatMap((id) => (data.value.champions.has(id) ? [data.value.champions.get(id)!] : [])) : []);
  const recent = known(personal.recent);
  const pool = known(personal.pool.map((p) => p.championId));

  return (
    <div className="home">
      <div className="home__main">
        <header className="home__hello enter">
          <h1 className="page__title">{summoner ? t("Merhaba, {name}", { name: summoner.gameName }) : "Vizier"}</h1>
          <p className="page__subtitle">
            {patch ? t("Yama {patch}", { patch }) : t("EUW ve TR oyuncuları için League of Legends yardımcısı.")}
            {patch && (
              <>
                {" "}
                <button type="button" className="link" onClick={() => onNavigate({ page: "patches" })}>
                  {t("Neler değişti")}
                </button>{" "}
                <button type="button" className="link" onClick={() => openExternal(PATCH_NOTES[lang])}>
                  {t("Yama notlarını aç")}
                </button>
              </>
            )}
          </p>
          <ClientStatus status={lcu} />
        </header>

        <nav className="home__actions enter" aria-label={t("Hızlı erişim")}>
          {actions.map((action) => (
            <button key={action.title} type="button" className="action" disabled={action.disabled} onClick={action.onClick}>
              <NavIcon name={action.icon} className="action__icon" />
              <span className="action__title">{action.title}</span>
              <span className="action__text">{action.text}</span>
            </button>
          ))}
        </nav>

        <div className="home__lists enter">
          <section aria-labelledby="home-recent">
            <h2 id="home-recent" className="section-title">{t("Son baktıkların")}</h2>
            {recent.length > 0 && data.status === "done" ? (
              <div className="home__champions">
                {recent.map((c) => (
                  <ChampionCard key={c.key} version={data.value.version} championId={c.id} name={c.name} onOpen={() => onOpenChampion(c.key, null)} />
                ))}
              </div>
            ) : (
              <p className="state__text">{t("Açtığın şampiyonlar burada görünür. Aramak için Ctrl K.")}</p>
            )}
          </section>
          <section aria-labelledby="home-pool">
            <h2 id="home-pool" className="section-title">{t("Şampiyon havuzun")}</h2>
            {pool.length > 0 && data.status === "done" ? (
              <div className="home__champions">
                {pool.map((c) => {
                  const pick = personal.pool.find((p) => p.championId === c.key);
                  return (
                    <PoolCard
                      key={c.key}
                      version={data.value.version}
                      champion={c}
                      position={pick?.position ?? null}
                      onOpen={() => onOpenChampion(c.key, pick?.position ?? null)}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="state__text">{t("Bir şampiyonun sayfasında \"Havuzuna ekle\"ye basınca burada ve şampiyon seçiminde görünür.")}</p>
            )}
          </section>
        </div>

        <PoolPatch onNavigate={onNavigate} />
        <PoolMoves onOpenChampion={onOpenChampion} />

        <MetaPicks onOpenChampion={onOpenChampion} />
        <MetaMovers onOpenChampion={onOpenChampion} />
      </div>

      <LiquidGlass className="panel home__pros" radius={28} strength={2.5} scroll>
        {personal.followed.length > 0 && (
          <>
            <h2 className="section-title">{t("Takip ettiğin pro'lar")}</h2>
            <ProBuildList
              filter={{ limit: 4 }}
              players={personal.followed}
              compact
              emptyText={t("Takip ettiğin oyuncuların son 30 günde maçı yok.")}
            />
          </>
        )}
        <h2 className="section-title">{t("Son pro build'ler")}</h2>
        <ProBuildList
          filter={{ limit: 6 }}
          compact
          emptyText={t("Bu filtreyle henüz pro maçı yok. Vizier birkaç dakikada bir yeni maçları alıyor.")}
        />
      </LiquidGlass>
    </div>
  );
}

/** A pool pick with how it stands this patch: tier, win rate and the change since the last one. */
function PoolCard({ version, champion, position, onOpen }: { version: string; champion: Champion; position: string | null; onOpen: () => void }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`ally:${champion.key}:${position}`, () => getChampion(champion.key, position));
  const o = state.status === "done" ? state.value : null;
  const change = o?.winRateChange;
  const patched = usePoolChanges().has(String(champion.key));
  const detail = o
    ? [
        o.tier ? t("{tier} tier", { tier: o.tier }) : null,
        formatPercent(o.winRate, lang, 1),
        change != null && Math.abs(change) >= 0.005 ? t("geçen yamaya göre {change}", { change: `${change > 0 ? "+" : "−"}${Math.abs(change * 100).toFixed(1)}` }) : null,
        patched ? t("bu yamada değişti") : null,
      ]
        .filter(Boolean)
        .join(", ")
    : undefined;
  return <ChampionCard version={version} championId={champion.id} name={champion.name} detail={detail} onOpen={onOpen} />;
}
