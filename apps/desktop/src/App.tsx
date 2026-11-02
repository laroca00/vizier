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
import { useSettings } from "./settings";
import { LiquidGlass } from "./ui/LiquidGlass";
import { ShaderGradient } from "./ui/ShaderGradient";
import { SplashLayers, SplashProvider } from "./ui/Splash";
import { UpdateNotice } from "./UpdateNotice";
import "./App.css";
import "./dashboard.css";
import "./shell.css";
import { ClientStatus } from "./ClientStatus";
import { NavIcon, type IconName } from "./ui/NavIcon";

// Night cobalt to turquoise across the plane, bright cobalt on the folds.
const GRADIENT: [string, string, string] = ["#0b1846", "#1c9c92", "#2f55c8"];

type View = "home" | "about" | "draft" | "queue" | "settings" | "tiers" | "pros" | "champion" | "profile";

const fixture = champSelectFixture();
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
  const [view, setView] = useState<View>(draft ? "draft" : "home");
  const [navigated, setNavigated] = useState(false);
  const [coaching, setCoaching] = useState<CoachTarget | null>(null);
  const [searching, setSearching] = useState(false);
  const [champion, setChampion] = useState<{ id: number; position: string | null; queue: number } | null>(null);
  const [riotId, setRiotId] = useState<RiotId | null>(null);
  const [splash, setSplash] = useState<string | null>(null);
  const draftActive = useRef(draft !== null);
  const queueActive = useRef(false);
  const [queuedAt, setQueuedAt] = useState(Date.now);
  const windowActive = useWindowActive();
  const analysedGame = useRef<number | null>(null);

  const phase = lcu.state === "connected" ? lcu.phase : null;
  const summoner = lcu.state === "connected" ? lcu.summoner : null;
  const lastGameId = lcu.state === "connected" ? lcu.lastGameId : null;
  const platform = platformOf(lcu.state === "connected" ? lcu.region : null);
  const clientLocale = lcu.state === "connected" ? (lcu.region?.locale ?? null) : null;

  useEffect(() => setClientLocale(clientLocale), [clientLocale]);

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

  const items: { id: View; label: string; icon: IconName; live?: boolean }[] = [
    { id: "home", label: "Panel", icon: "home" },
    ...(inQueue && summoner ? [{ id: "queue" as const, label: "Sıra", icon: "queue" as const, live: true }] : []),
    ...(draft ? [{ id: "draft" as const, label: "Şampiyon seçimi", icon: "draft" as const, live: true }] : []),
    { id: "tiers", label: "Tier listesi", icon: "tiers" },
    { id: "pros", label: "Pro'lar", icon: "pros" },
  ];
  const footItems: { id: View; label: string; icon: IconName }[] = [
    { id: "settings", label: "Ayarlar", icon: "settings" },
    { id: "about", label: "Hakkında", icon: "about" },
  ];
  const navButton = (item: { id: View; label: string; icon: IconName; live?: boolean }) => (
    <button
      key={item.id}
      type="button"
      className="side__item"
      aria-current={item.id === view ? "page" : undefined}
      data-live={item.live || undefined}
      onClick={() => open(item.id)}
    >
      <NavIcon name={item.icon} />
      <span>{t(item.label)}</span>
    </button>
  );

  function open(id: View) {
    if (id === view) return;
    setNavigated(true);
    setView(id);
  }

  return (
    <div className="shell" data-navigated={navigated || undefined}>
      <ShaderGradient
        className="shell__backdrop"
        colors={GRADIENT}
        strength={3}
        reflection={0.18}
        paused={(settings.pauseBackgroundInGame && phase === "InProgress") || (settings.pauseBackgroundUnfocused && !windowActive)}
      />
      <SplashLayers className="splash" url={splash} />
      <aside className="shell__side">
        <LiquidGlass className="side" radius={26} blur={4}>
          <p className="side__brand">Vizier</p>
          <nav className="side__nav" aria-label={t("Ana menü")}>
            {items.map(navButton)}
          </nav>
          <div className="side__foot">{footItems.map(navButton)}</div>
        </LiquidGlass>
      </aside>
      <header className="shell__top">
        <UpdateNotice />
        <ClientStatus status={lcu} />
        <LiquidGlass className="nav" shape="pill" blur={4}>
          <button type="button" className="nav__item nav__search" aria-keyshortcuts="Control+K" onClick={() => setSearching(true)}>
            {t("Ara")} <kbd>Ctrl K</kbd>
          </button>
        </LiquidGlass>
      </header>
      <SplashProvider value={setSplash}>
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
  );
}

export default App;
