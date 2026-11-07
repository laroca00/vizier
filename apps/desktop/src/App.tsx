import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { champSelectFixture } from "./dev/fixtures";
import { matchIdFor, platformOf, useChampSelect, useLcuStatus } from "./lcu";
import { About } from "./pages/About";
import { ChampionPage } from "./pages/ChampionPage";
import { ChampSelectPage } from "./pages/ChampSelectPage";
import { Home } from "./pages/Home";
import { ProfilePage } from "./pages/ProfilePage";
import { ProsPage } from "./pages/ProsPage";
import { QueuePage } from "./pages/QueuePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TierListPage } from "./pages/TierListPage";
import type { CoachTarget } from "./ProfileCard";
import { SearchPalette, type RiotId } from "./SearchPalette";
import { setClientLocale, useT } from "./i18n";
import { updateSettings, useSettings } from "./settings";
import { FlatGlass } from "./ui/LiquidGlass";
import { SplashLayers, SplashProvider } from "./ui/Splash";
import { UpdateNotice } from "./UpdateNotice";
import "./App.css";
import "./dashboard.css";
import "./shell.css";
import { champions } from "./data/ddragon";
import { Sidebar, type NavGroup, type NavItem } from "./Sidebar";
import { NavIcon } from "./ui/NavIcon";

type View = "home" | "about" | "draft" | "queue" | "settings" | "tiers" | "pros" | "champion" | "profile";

const LABELS: Record<View, string> = {
  home: "Panel",
  about: "Hakkında",
  draft: "Şampiyon seçimi",
  queue: "Sıra",
  settings: "Ayarlar",
  tiers: "Tier listesi",
  pros: "Pro'lar",
  champion: "Tier listesi",
  profile: "Profil",
};

function useChampionName(id: number | null) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    if (id === null) return setName(null);
    let current = true;
    champions().then((all) => current && setName(all.get(id)?.name ?? null), () => {});
    return () => {
      current = false;
    };
  }, [id]);
  return name;
}

const fixture = champSelectFixture();

/** Dev only: `?view=tiers` opens a page directly, for screenshots without clicking. */
function devView(): View | null {
  if (!import.meta.env.DEV) return null;
  const view = new URLSearchParams(location.search).get("view");
  return view && view in LABELS ? (view as View) : null;
}
const POST_GAME_PHASES = new Set(["PreEndOfGame", "EndOfGame"]);
const QUEUE_PHASES = new Set(["Matchmaking", "ReadyCheck"]);

/** False while the window is hidden, minimised or behind another app. */
function useWindowActive() {
  const [active, setActive] = useState(() => !document.hidden && document.hasFocus());
  useEffect(() => {
    const update = () => setActive(!document.hidden && document.hasFocus());
    window.addEventListener("focus", update);
    window.addEventListener("blur", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.removeEventListener("focus", update);
      window.removeEventListener("blur", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return active;
}

async function bringToFront() {
  if (!isTauri()) return;
  const window = getCurrentWindow();
  await window.show();
  await window.unminimize();
  await window.setFocus();
}

function App() {
  const lcu = useLcuStatus();
  const settings = useSettings();
  const t = useT();
  const draft = useChampSelect() ?? fixture;
  const [view, setView] = useState<View>(() => devView() ?? (draft ? "draft" : "home"));
  const [navigated, setNavigated] = useState(false);
  const [coaching, setCoaching] = useState<CoachTarget | null>(null);
  const [searching, setSearching] = useState(false);
  const [champion, setChampion] = useState<{ id: number; position: string | null; queue: number } | null>(null);
  const [riotId, setRiotId] = useState<RiotId | null>(null);
  const [splash, setSplash] = useState<string | null>(null);
  const draftActive = useRef(draft !== null);
  const queueActive = useRef(false);
  const [queuedAt, setQueuedAt] = useState(Date.now);
  const analysedGame = useRef<number | null>(null);

  const phase = lcu.state === "connected" ? lcu.phase : null;
  const summoner = lcu.state === "connected" ? lcu.summoner : null;
  const lastGameId = lcu.state === "connected" ? lcu.lastGameId : null;
  const platform = platformOf(lcu.state === "connected" ? lcu.region : null);
  const clientLocale = lcu.state === "connected" ? (lcu.region?.locale ?? null) : null;

  useEffect(() => setClientLocale(clientLocale), [clientLocale]);

  // Nobody looks at Vizier while the game is in front, so WebView2 can hand
  // memory back to the game until the player switches over.
  const windowActive = useWindowActive();
  const behindGame = phase === "InProgress" && !windowActive;
  useEffect(() => {
    if (isTauri()) invoke("set_background", { background: behindGame }).catch(() => {});
  }, [behindGame]);

  // Jump to the draft when it starts and leave it when it ends, but don't
  // pull the player back if they switched away during it.
  useEffect(() => {
    const active = draft !== null;
    if (active && !draftActive.current) {
      setView("draft");
      if (settings.showOnChampSelect) bringToFront();
    }
    if (!active && draftActive.current) setView((v) => (v === "draft" ? "home" : v));
    draftActive.current = active;
  }, [draft, settings.showOnChampSelect]);

  // The queue screen comes up while matchmaking, without taking focus, and
  // gives way to champ select or home afterwards.
  const inQueue = phase !== null && QUEUE_PHASES.has(phase);
  useEffect(() => {
    if (inQueue && !queueActive.current) {
      setQueuedAt(Date.now());
      if (settings.queueCompanion && summoner) setView((v) => (v === "home" ? "queue" : v));
    }
    if (!inQueue && queueActive.current) setView((v) => (v === "queue" ? "home" : v));
    queueActive.current = inQueue;
  }, [inQueue, settings.queueCompanion, summoner]);

  useEffect(() => {
    if (!settings.openAnalysisAfterGame || !phase || !POST_GAME_PHASES.has(phase)) return;
    if (!lastGameId || !summoner || analysedGame.current === lastGameId) return;
    analysedGame.current = lastGameId;
    setCoaching({ matchId: matchIdFor(platform, lastGameId), puuid: summoner.puuid, championName: "Son", justFinished: true });
    setView("home");
  }, [phase, lastGameId, summoner, platform, settings.openAnalysisAfterGame]);

  useEffect(() => {
    if (isTauri()) invoke("set_overlay_enabled", { enabled: settings.overlay }).catch(() => {});
  }, [settings.overlay]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function openChampion(id: number, position: string | null = null, queue = 420) {
    setNavigated(true);
    setChampion({ id, position, queue });
    setView("champion");
  }

  function openProfile(id: RiotId) {
    setNavigated(true);
    setRiotId(id);
    setView("profile");
  }

  const groups: NavGroup<View>[] = [
    { items: [{ id: "home", label: "Panel", icon: "home" }] },
    {
      heading: "Şu an",
      items: [
        ...(inQueue && summoner ? [{ id: "queue" as const, label: "Sıra", icon: "queue" as const, live: true }] : []),
        ...(draft ? [{ id: "draft" as const, label: "Şampiyon seçimi", icon: "draft" as const, live: true }] : []),
      ],
    },
    {
      heading: "Keşfet",
      items: [
        { id: "tiers", label: "Tier listesi", icon: "tiers" },
        { id: "pros", label: "Pro'lar", icon: "pros" },
      ],
    },
  ];
  const footItems: NavItem<View>[] = [
    { id: "settings", label: "Ayarlar", icon: "settings" },
    { id: "about", label: "Hakkında", icon: "about" },
  ];
  const championName = useChampionName(view === "champion" ? (champion?.id ?? null) : null);

  // Where the page sits, read left to right in the top bar.
  const crumbs: string[] =
    view === "champion"
      ? [t("Tier listesi"), championName ?? ""]
      : view === "profile" && riotId
        ? [t("Profil"), `${riotId.gameName}#${riotId.tagLine}`]
        : [t(LABELS[view])];

  function open(id: View) {
    if (id === view) return;
    setNavigated(true);
    setView(id);
  }

  return (
    <FlatGlass.Provider value={true}>
    <div className="shell" data-navigated={navigated || undefined} data-collapsed={settings.sidebarCollapsed || undefined}>
      <Sidebar
        lcu={lcu}
        groups={groups}
        foot={footItems}
        current={view === "champion" ? "tiers" : view}
        collapsed={settings.sidebarCollapsed}
        onOpen={open}
        onSearch={() => setSearching(true)}
        onOpenOwnProfile={summoner ? () => openProfile({ gameName: summoner.gameName, tagLine: summoner.tagLine, platform }) : null}
      />
      <header className="top" data-tauri-drag-region>
        <button
          type="button"
          className="top__toggle"
          aria-label={t(settings.sidebarCollapsed ? "Menüyü aç" : "Menüyü daralt")}
          aria-pressed={settings.sidebarCollapsed}
          onClick={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}
        >
          <NavIcon name="sidebar" size={18} className="top__icon" />
        </button>
        <ol className="top__crumbs" aria-label={t("Konum")} data-tauri-drag-region>
          <li data-tauri-drag-region>Vizier</li>
          {crumbs.filter(Boolean).map((crumb, i, all) => (
            <li key={i} data-tauri-drag-region aria-current={i === all.length - 1 ? "page" : undefined}>
              {crumb}
            </li>
          ))}
        </ol>
        <UpdateNotice />
        <button type="button" className="top__search" aria-keyshortcuts="Control+K" onClick={() => setSearching(true)}>
          <NavIcon name="search" size={16} className="top__icon" />
          <span>{t("Şampiyon ya da oyuncu ara")}</span>
          <kbd>Ctrl K</kbd>
        </button>
      </header>
      <SplashProvider value={setSplash}>
        <div className="shell__stage">
          <SplashLayers className="splash" url={splash} />
        </div>
        <main className="shell__main" key={view}>
          {view === "draft" && draft ? (
            <ChampSelectPage draft={draft} puuid={summoner?.puuid ?? null} />
          ) : view === "queue" && summoner ? (
            <QueuePage summoner={summoner} platform={platform} since={queuedAt} onOpenChampion={openChampion} />
          ) : view === "about" ? (
            <About />
          ) : view === "settings" ? (
            <SettingsPage />
          ) : view === "tiers" ? (
            <TierListPage onOpenChampion={openChampion} />
          ) : view === "pros" ? (
            <ProsPage />
          ) : view === "champion" && champion ? (
            <ChampionPage
              key={`${champion.id}:${champion.position}:${champion.queue}`}
              championId={champion.id}
              initialPosition={champion.position}
              initialQueue={champion.queue}
              onOpenChampion={openChampion}
            />
          ) : view === "profile" && riotId ? (
            <ProfilePage key={`${riotId.platform}:${riotId.gameName}#${riotId.tagLine}`} riotId={riotId} onOpenChampion={openChampion} />
          ) : (
            <Home lcu={lcu} coaching={coaching} onCoach={setCoaching} onOpenChampion={openChampion} />
          )}
        </main>
      </SplashProvider>
      <SearchPalette open={searching} onClose={() => setSearching(false)} onChampion={(id) => openChampion(id)} onProfile={openProfile} home={platform} />
    </div>
    </FlatGlass.Provider>
  );
}

export default App;
