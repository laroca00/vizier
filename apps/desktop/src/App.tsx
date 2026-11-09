import { favouriteTarget, type Favourite } from "./favourites";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useChampSelectMock } from "./dev/champSelectMock";
import { champSelectFixture } from "./dev/fixtures";
import { useChampSelect, useLcuStatus, useLobby } from "./lcu";
import { useMyRank } from "./myRank";
import { lobbyRoles } from "./clientFlow";
import { ChampSelectPage } from "./pages/ChampSelectPage";
import { Home } from "./pages/Home";
import { noteRecent, usePersonal } from "./personal";
import { pageRoute, useNavigation, type Page, type Route } from "./router";
import { changedHotkeys } from "./overlay/hotkeys";
import { clientOpened, gameEdge, isTrayAction } from "./followClient";
import { OpenProProvider } from "./proLink";
import { OpenChampionProvider } from "./championLink";
import { OpenSourcesProvider } from "./sourcesLink";
import { OpenMatchupProvider } from "./matchupLink";
import { OpenPageProvider } from "./pageLink";
import { useAutoAcceptReady, useReadyCheckAlert } from "./readyCheck";
import { enteredQueueFlow, planPreload, runPreload } from "./preload";
import { SearchPalette } from "./SearchPalette";
import { SharePaste } from "./library/SharePaste";
import { setClientLocale, useT } from "./i18n";
import { updateSettings, useSettings } from "./settings";
import { listen } from "@tauri-apps/api/event";
import { FlatGlass } from "./ui/LiquidGlass";
import { SplashLayers, SplashProvider } from "./ui/Splash";
import { UpdateNotice } from "./UpdateNotice";
import { useOnline } from "./useOnline";
import { champions } from "./data/ddragon";
import { Sidebar, type NavGroup, type NavItem } from "./Sidebar";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { Welcome } from "./Welcome";
import { useTurnAlarm } from "./draft/turnAlarm";
import { isTyping } from "./shortcuts";
import { COMMAND_PREFIX, commandLinks, commandPatch } from "./commands";
import { IconButton } from "./ui/Button";
import { NavIcon } from "./ui/NavIcon";
import { ErrorBoundary, PageCrashed, Skeleton } from "./ui/States";
import { ToastProvider } from "./ui/Toast";

// Sections load when first opened, so starting the app and champ select stay
// quick; Home and champ select are in the main bundle.
const About = lazy(() => import("./pages/About").then((m) => ({ default: m.About })));
const ChampionPage = lazy(() => import("./pages/ChampionPage").then((m) => ({ default: m.ChampionPage })));
const OverlayPage = lazy(() => import("./pages/OverlayPage").then((m) => ({ default: m.OverlayPage })));
const BuildsPage = lazy(() => import("./pages/BuildsPage").then((m) => ({ default: m.BuildsPage })));
const ChampionsPage = lazy(() => import("./pages/ChampionsPage").then((m) => ({ default: m.ChampionsPage })));
const SimulatorPage = lazy(() => import("./pages/SimulatorPage").then((m) => ({ default: m.SimulatorPage })));
const PatchesPage = lazy(() => import("./pages/PatchesPage").then((m) => ({ default: m.PatchesPage })));
const MatchupPage = lazy(() => import("./pages/MatchupPage").then((m) => ({ default: m.MatchupPage })));
const AugmentsPage = lazy(() => import("./pages/AugmentsPage").then((m) => ({ default: m.AugmentsPage })));
const ArchetypesPage = lazy(() => import("./pages/ArchetypesPage").then((m) => ({ default: m.ArchetypesPage })));
const CombosPage = lazy(() => import("./pages/CombosPage").then((m) => ({ default: m.CombosPage })));
const MatrixPage = lazy(() => import("./pages/MatrixPage").then((m) => ({ default: m.MatrixPage })));
const ChallengePage = lazy(() => import("./pages/ChallengePage").then((m) => ({ default: m.ChallengePage })));
const SynergyPage = lazy(() => import("./pages/SynergyPage").then((m) => ({ default: m.SynergyPage })));
const TemplatesPage = lazy(() => import("./pages/TemplatesPage").then((m) => ({ default: m.TemplatesPage })));
const LabPage = lazy(() => import("./pages/LabPage").then((m) => ({ default: m.LabPage })));
const FavouritesPage = lazy(() => import("./pages/FavouritesPage").then((m) => ({ default: m.FavouritesPage })));
const JournalPage = lazy(() => import("./pages/JournalPage").then((m) => ({ default: m.JournalPage })));
const ItemsPage = lazy(() => import("./pages/ItemsPage").then((m) => ({ default: m.ItemsPage })));
const RunesPage = lazy(() => import("./pages/RunesPage").then((m) => ({ default: m.RunesPage })));
const QuizPage = lazy(() => import("./pages/QuizPage").then((m) => ({ default: m.QuizPage })));
const ProsPage = lazy(() => import("./pages/ProsPage").then((m) => ({ default: m.ProsPage })));
const ProPlayerPage = lazy(() => import("./pages/ProPlayerPage").then((m) => ({ default: m.ProPlayerPage })));
const SettingsPage = lazy(() => import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const TierListPage = lazy(() => import("./pages/TierListPage").then((m) => ({ default: m.TierListPage })));

const LABELS: Record<Page, string> = {
  home: "Ana sayfa",
  draft: "Şampiyon seçimi",
  tiers: "Tier listesi",
  pros: "Pro build'ler",
  pro: "Pro oyuncu",
  builds: "Build kütüphanesi",
  champions: "Şampiyonlar",
  simulator: "Draft simülatörü",
  patches: "Yama takibi",
  quiz: "Şampiyon bilmecesi",
  augments: "Augment'ler",
  matchup: "Eşleşme",
  journal: "Günlük",
  favourites: "Favoriler",
  lab: "Eşya laboratuvarı",
  combos: "Kombo kütüphanesi",
  archetypes: "Şampiyon tipleri",
  matrix: "Karşı seçim matrisi",
  challenge: "Draft meydan okuması",
  templates: "Takım şablonları",
  synergy: "Sinerji gezgini",
  items: "Eşyalar",
  runes: "Rünler",
  champion: "Şampiyonlar",
  overlay: "Overlay",
  settings: "Ayarlar",
  about: "Hakkında",
};

/** The menu entry a page belongs to; a champion page sits under the champion list. */
const SECTION: Record<Page, Page> = { ...Object.fromEntries(Object.keys(LABELS).map((p) => [p, p])), champion: "champions", pro: "pros" } as Record<Page, Page>;

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
function devRoute(): Route | null {
  if (!import.meta.env.DEV) return null;
  const view = new URLSearchParams(location.search).get("view");
  if (view === "pro") return { page: "pro", player: "Chovy" };
  if (view === "lab") return { page: "lab", championId: 103, position: "MIDDLE" };
  if (view === "matchup") return { page: "matchup", championId: 103, opponentId: 238, position: "MIDDLE" };
  if (view === "champion") return { page: "champion", championId: Number(new URLSearchParams(location.search).get("id") ?? 103), position: null, queue: 420 };
  return view && view in LABELS && view !== "champion" ? pageRoute(view as Page) : null;
}

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
  useMyRank(lcu);
  const lobby = useLobby();
  const settings = useSettings();
  const online = useOnline();
  const t = useT();
  const mock = useChampSelectMock();
  const draft = useChampSelect() ?? mock ?? fixture;
  const nav = useNavigation(devRoute() ?? { page: draft ? "draft" : "home" });
  const { route, navigate, replace } = nav;
  const [navigated, setNavigated] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showKeys, setShowKeys] = useState(false);
  const [splash, setSplash] = useState<string | null>(null);
  const draftActive = useRef(draft !== null);
  const shortcutsRef = useRef<Page[]>([]);
  const goRef = useRef<(next: Route) => void>(() => {});

  const phase = lcu.state === "connected" ? lcu.phase : null;
  const clientLocale = lcu.state === "connected" ? (lcu.region?.locale ?? null) : null;

  useEffect(() => setClientLocale(clientLocale), [clientLocale]);
  useReadyCheckAlert(phase, settings.readyCheckAlert);
  useTurnAlarm(draft ?? null, settings.turnAlarm);
  useAutoAcceptReady(phase, settings.autoAcceptReady);

  // Champ select opens faster when its data is already cached from the lobby.
  const personal = usePersonal();
  const previousPhase = useRef<string | null>(null);
  useEffect(() => {
    if (enteredQueueFlow(previousPhase.current, phase)) runPreload(planPreload(personal.pool, lobbyRoles(lobby)));
    previousPhase.current = phase;
    // The pool is read when the lobby opens; later edits don't need to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // The lobby can report its roles a moment after the phase changes, or change them while waiting.
  const rolesKey = lobbyRoles(lobby).join(",");
  useEffect(() => {
    if (rolesKey && phase && ["Lobby", "Matchmaking", "ReadyCheck"].includes(phase)) runPreload(planPreload(personal.pool, rolesKey.split(",")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesKey]);

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
      navigate({ page: "draft" });
      if (settings.showOnChampSelect) bringToFront();
    }
    if (!active && draftActive.current && route.page === "draft") replace({ page: "home" });
    draftActive.current = active;
  }, [draft, settings.showOnChampSelect, navigate, replace, route.page]);

  // Remembers whether the window was up when the game began, so it only returns if it was.
  const phaseBefore = useRef<string | null>(phase);
  const wasUp = useRef(false);
  useEffect(() => {
    const edge = gameEdge(phaseBefore.current, phase);
    phaseBefore.current = phase;
    if (!edge || !isTauri()) return;
    if (edge === "start" && settings.hideOnGame) {
      invoke<boolean>("main_window_up")
        .then((up) => {
          wasUp.current = up;
          if (up) return invoke("hide_to_tray");
        })
        .catch(() => {});
    } else if (edge === "end" && wasUp.current) {
      wasUp.current = false;
      invoke("show_from_tray").catch(() => {});
    }
  }, [phase, settings.hideOnGame]);

  const clientBefore = useRef(lcu.state);
  useEffect(() => {
    const opened = clientOpened(clientBefore.current, lcu.state);
    clientBefore.current = lcu.state;
    if (!opened || !isTauri() || !settings.showOnClientOpen) return;
    // Only a window sitting in the tray needs bringing up; one in front is left alone.
    invoke<boolean>("main_window_up")
      .then((up) => (up ? undefined : invoke("show_from_tray")))
      .catch(() => {});
  }, [lcu.state, settings.showOnClientOpen]);

  const overlayOnRef = useRef(settings.overlay);
  overlayOnRef.current = settings.overlay;
  useEffect(() => {
    if (!isTauri()) return;
    const unlisten = listen<string>("tray-action", (event) => {
      if (!isTrayAction(event.payload)) return;
      if (event.payload === "overlay") updateSettings({ overlay: !overlayOnRef.current });
      else goRef.current({ page: "draft" });
    });
    return () => void unlisten.then((stop) => stop());
  }, []);

  useEffect(() => {
    // The Rust side refuses a clash or a combination it cannot read and keeps the old keys.
    if (isTauri()) invoke("set_hotkeys", { bindings: changedHotkeys(settings.hotkeys) }).catch(() => {});
  }, [settings.hotkeys]);

  useEffect(() => {
    if (isTauri()) invoke("set_overlay_enabled", { enabled: settings.overlay }).catch(() => {});
  }, [settings.overlay]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearching(true);
      }
      if (event.key === "?" && !event.ctrlKey && !event.altKey && !event.metaKey && !isTyping(event.target)) {
        event.preventDefault();
        setShowKeys((open) => !open);
      }
      const digit = Number(event.key);
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && digit >= 1 && digit <= 9) {
        const page = shortcutsRef.current[digit - 1];
        if (page) {
          event.preventDefault();
          goRef.current(pageRoute(page));
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(next: Route) {
    setNavigated(true);
    nav.navigate(next);
  }
  goRef.current = go;

  function openChampion(championId: number, position: string | null = null, queue = 420) {
    noteRecent(championId);
    go({ page: "champion", championId, position, queue });
  }

  function openMatchup(championId: number | null, opponentId: number | null, position: string) {
    go({ page: "matchup", championId, opponentId, position });
  }

  function openFavourite(f: Favourite) {
    const target = favouriteTarget(f);
    if (!target) return;
    if ("champion" in target) openChampion(target.champion, null);
    else go(target.route);
  }

  const groups: NavGroup<Page>[] = [
    { items: [{ id: "home", label: "Ana sayfa", icon: "home" }] },
    {
      heading: "Şu an",
      items: draft ? [{ id: "draft", label: "Şampiyon seçimi", icon: "draft", live: true }] : [],
    },
    {
      heading: "Hazırlan",
      items: [
        { id: "champions", label: "Şampiyonlar", icon: "champions" },
        { id: "tiers", label: "Tier listesi", icon: "tiers" },
        { id: "matchup", label: "Eşleşme", icon: "matchup" },
        { id: "matrix", label: "Karşı seçim matrisi", icon: "matchup" },
        { id: "synergy", label: "Sinerji gezgini", icon: "archetypes" },
        { id: "pros", label: "Pro build'ler", icon: "pros" },
        { id: "augments", label: "Augment'ler", icon: "augments" },
      ],
    },
    {
      heading: "Keşfet",
      items: [
        { id: "items", label: "Eşyalar", icon: "items" },
        { id: "runes", label: "Rünler", icon: "runes" },
        { id: "combos", label: "Kombo kütüphanesi", icon: "combos" },
        { id: "archetypes", label: "Şampiyon tipleri", icon: "archetypes" },
        { id: "templates", label: "Takım şablonları", icon: "simulator" },
        { id: "patches", label: "Yama takibi", icon: "patches" },
      ],
    },
    {
      heading: "Araçlar",
      items: [
        { id: "builds", label: "Build kütüphanesi", icon: "library" },
        { id: "lab", label: "Eşya laboratuvarı", icon: "lab" },
        { id: "simulator", label: "Draft simülatörü", icon: "simulator" },
        { id: "journal", label: "Günlük", icon: "journal" },
        { id: "favourites", label: "Favoriler", icon: "library" },
      ],
    },
    {
      heading: "Oyna",
      items: [
        { id: "quiz", label: "Şampiyon bilmecesi", icon: "quiz" },
        { id: "challenge", label: "Draft meydan okuması", icon: "quiz" },
      ],
    },
  ];
  // Ctrl+1 to Ctrl+9 keep the pages they opened before the menu was grouped,
  // so the numbers players learned still work; the live champ select entry is never one.
  const shortcutOrder: Page[] = ["home", "champions", "tiers", "builds", "pros", "augments", "simulator", "patches", "quiz"];
  const allItems = groups.flatMap((g) => g.items);
  const shortcutPages = shortcutOrder.map((id) => allItems.find((item) => item.id === id)).filter((item): item is NavItem<Page> => !!item);
  for (const [i, item] of shortcutPages.entries()) item.shortcut = `Ctrl+${i + 1}`;
  shortcutsRef.current = shortcutPages.map((item) => item.id);
  const footItems: NavItem<Page>[] = [
    { id: "overlay", label: "Overlay", icon: "overlay" },
    { id: "settings", label: "Ayarlar", icon: "settings" },
    { id: "about", label: "Hakkında", icon: "about" },
  ];
  const championName = useChampionName(route.page === "champion" ? route.championId : null);

  // Where the page sits, read left to right in the top bar.
  const crumbs: string[] = route.page === "champion" ? [t("Şampiyonlar"), championName ?? ""] : [t(LABELS[route.page])];
  const routeKey = JSON.stringify(route);

  return (
    <FlatGlass.Provider value={true}>
    <ToastProvider>
    <OpenMatchupProvider value={openMatchup}>
    <OpenChampionProvider value={openChampion}>
    <OpenSourcesProvider value={() => go({ page: "about" })}>
    <OpenPageProvider value={go}>
    <OpenProProvider value={(player) => go({ page: "pro", player })}>
    <div className="shell" data-navigated={navigated || undefined} data-collapsed={settings.sidebarCollapsed || undefined}>
      <Sidebar
        lcu={lcu}
        groups={groups}
        foot={footItems}
        current={SECTION[route.page]}
        collapsed={settings.sidebarCollapsed}
        onOpen={(page) => page !== route.page && go(pageRoute(page))}
        onSearch={() => setSearching(true)}
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
        <span className="top__history">
          <IconButton label={t("Geri (Alt+Sol)")} disabled={!nav.canGoBack} onClick={nav.back}>
            <NavIcon name="chevron" size={16} className="top__back" />
          </IconButton>
          <IconButton label={t("İleri (Alt+Sağ)")} disabled={!nav.canGoForward} onClick={nav.forward}>
            <NavIcon name="chevron" size={16} />
          </IconButton>
        </span>
        <ol className="top__crumbs" aria-label={t("Konum")} data-tauri-drag-region>
          <li data-tauri-drag-region>Vizier</li>
          {crumbs.filter(Boolean).map((crumb, i, all) => (
            <li key={i} data-tauri-drag-region aria-current={i === all.length - 1 ? "page" : undefined}>
              {crumb}
            </li>
          ))}
        </ol>
        {!online && (
          <span className="top__offline" role="status">
            {t("Çevrimdışı: son kaydedilen veriler gösteriliyor")}
          </span>
        )}
        <UpdateNotice />
        <button type="button" className="top__search" aria-keyshortcuts="Control+K" onClick={() => setSearching(true)}>
          <NavIcon name="search" size={16} className="top__icon" />
          <span>{t("Şampiyon ara")}</span>
          <kbd>Ctrl K</kbd>
        </button>
      </header>
      <SplashProvider value={setSplash}>
        <div className="shell__stage">
          <SplashLayers className="splash" url={splash} />
        </div>
        <main className="shell__main" key={routeKey}>
          <ErrorBoundary fallback={(reset) => <PageCrashed onReset={reset} />}>
            <Suspense fallback={<Skeleton lines={6} label={t("Yükleniyor")} />}>
            {route.page === "draft" && draft ? (
              <ChampSelectPage draft={draft} />
            ) : route.page === "about" ? (
              <About />
            ) : route.page === "settings" ? (
              <SettingsPage />
            ) : route.page === "overlay" ? (
              <OverlayPage />
            ) : route.page === "tiers" ? (
              <TierListPage view={route.view} onView={(view) => replace({ page: "tiers", view })} onOpenChampion={openChampion} />
            ) : route.page === "augments" ? (
              <AugmentsPage onOpenChampion={(id) => openChampion(id)} />
            ) : route.page === "matchup" ? (
              <MatchupPage route={route} onChange={replace} />
            ) : route.page === "items" ? (
              <ItemsPage onOpenChampion={(id, position) => openChampion(id, position)} initialItem={route.itemId ?? null} />
            ) : route.page === "runes" ? (
              <RunesPage onOpenChampion={(id, position) => openChampion(id, position)} initialRune={route.runeId ?? null} />
            ) : route.page === "journal" ? (
              <JournalPage onOpenChampion={(id) => openChampion(id)} onOpenMatchup={openMatchup} />
            ) : route.page === "favourites" ? (
              <FavouritesPage onOpen={openFavourite} />
            ) : route.page === "archetypes" ? (
              <ArchetypesPage onOpenChampion={(id, position) => openChampion(id, position)} />
            ) : route.page === "combos" ? (
              <CombosPage onOpenChampion={(id) => openChampion(id)} />
            ) : route.page === "lab" ? (
              <LabPage route={route} onChange={replace} />
            ) : route.page === "synergy" ? (
              <SynergyPage route={route} onChange={replace} onOpenChampion={(id, position) => openChampion(id, position)} />
            ) : route.page === "templates" ? (
              <TemplatesPage onOpenChampion={(id, position) => openChampion(id, position)} />
            ) : route.page === "challenge" ? (
              <ChallengePage />
            ) : route.page === "matrix" ? (
              <MatrixPage route={route} onChange={replace} />
            ) : route.page === "quiz" ? (
              <QuizPage />
            ) : route.page === "patches" ? (
              <PatchesPage onOpenChampion={(id) => openChampion(id)} />
            ) : route.page === "simulator" ? (
              <SimulatorPage />
            ) : route.page === "champions" ? (
              <ChampionsPage onOpenChampion={(id, position) => openChampion(id, position)} />
            ) : route.page === "builds" ? (
              <BuildsPage onOpenChampion={(id, position) => openChampion(id, position)} initialBuild={route.buildId ?? null} />
            ) : route.page === "pros" ? (
              <ProsPage onOpenChampion={(id, position) => openChampion(id, position)} />
            ) : route.page === "pro" ? (
              <ProPlayerPage player={route.player} />
            ) : route.page === "champion" ? (
              <ChampionPage
                championId={route.championId}
                initialPosition={route.position}
                initialQueue={route.queue}
                onOpenChampion={openChampion}
                onOpenBuild={(buildId) => go({ page: "builds", buildId })}
                onOpenMatchup={openMatchup}
              />
            ) : (
              <Home lcu={lcu} lobby={lobby} draftActive={draft !== null} onOpenChampion={openChampion} onNavigate={go} onSearch={() => setSearching(true)} />
            )}
            </Suspense>
          </ErrorBoundary>
        </main>
      </SplashProvider>
      <SharePaste onAdded={() => go({ page: "builds" })} />
      {/* Never over a live champ select; dev screenshots open pages directly and skip it too. */}
      {!draft && !devRoute() && <Welcome onOpenOverlay={() => go({ page: "overlay" })} />}
      <ShortcutsHelp open={showKeys} onClose={() => setShowKeys(false)} pages={shortcutPages.map((item) => t(item.label))} />
      <SearchPalette
        open={searching}
        onClose={() => setSearching(false)}
        onChampion={(id) => openChampion(id)}
        links={[
          ...[...groups.flatMap((g) => g.items), ...footItems].map((item) => ({ id: item.id, label: t(item.label), icon: item.icon })),
          ...commandLinks(settings).map((c) => ({ ...c, label: t(c.label) })),
        ]}
        onLink={(id) => {
          if (!id.startsWith(COMMAND_PREFIX)) return go(pageRoute(id as Page));
          if (id === `${COMMAND_PREFIX}keys`) return setShowKeys(true);
          const patch = commandPatch(id, settings);
          if (patch) updateSettings(patch);
        }}
        onMatchup={openMatchup}
        onRoute={go}
      />
    </div>
    </OpenProProvider>
    </OpenPageProvider>
    </OpenSourcesProvider>
    </OpenChampionProvider>
    </OpenMatchupProvider>
    </ToastProvider>
    </FlatGlass.Provider>
  );
}

export default App;
