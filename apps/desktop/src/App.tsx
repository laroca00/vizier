import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { champSelectFixture } from "./dev/fixtures";
import { useChampSelect, useLcuStatus } from "./lcu";
import { About } from "./pages/About";
import { ChampSelectPage } from "./pages/ChampSelectPage";
import { Home } from "./pages/Home";
import { SettingsPage } from "./pages/SettingsPage";
import type { CoachTarget } from "./ProfileCard";
import { useSettings } from "./settings";
import { LiquidGlass } from "./ui/LiquidGlass";
import { ShaderGradient } from "./ui/ShaderGradient";
import "./App.css";

// Night cobalt to turquoise across the plane, bright cobalt on the folds.
const GRADIENT: [string, string, string] = ["#0b1846", "#1c9c92", "#2f55c8"];

type View = "home" | "about" | "draft" | "settings";

const fixture = champSelectFixture();
const POST_GAME_PHASES = new Set(["PreEndOfGame", "EndOfGame"]);

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
  const draft = useChampSelect() ?? fixture;
  const [view, setView] = useState<View>(draft ? "draft" : "home");
  const [navigated, setNavigated] = useState(false);
  const [coaching, setCoaching] = useState<CoachTarget | null>(null);
  const draftActive = useRef(draft !== null);
  const analysedGame = useRef<number | null>(null);

  const phase = lcu.state === "connected" ? lcu.phase : null;
  const summoner = lcu.state === "connected" ? lcu.summoner : null;
  const lastGameId = lcu.state === "connected" ? lcu.lastGameId : null;

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

  useEffect(() => {
    if (!settings.openAnalysisAfterGame || !phase || !POST_GAME_PHASES.has(phase)) return;
    if (!lastGameId || !summoner || analysedGame.current === lastGameId) return;
    analysedGame.current = lastGameId;
    setCoaching({ matchId: `TR1_${lastGameId}`, puuid: summoner.puuid, championName: "Son", justFinished: true });
    setView("home");
  }, [phase, lastGameId, summoner, settings.openAnalysisAfterGame]);

  const items: { id: View; label: string }[] = [
    { id: "home", label: "Ana sayfa" },
    ...(draft ? [{ id: "draft" as const, label: "Şampiyon seçimi" }] : []),
    { id: "settings", label: "Ayarlar" },
    { id: "about", label: "Hakkında" },
  ];

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
        paused={settings.pauseBackgroundInGame && phase === "InProgress"}
      />
      <nav className="shell__nav" aria-label="Ana menü">
        <LiquidGlass className="nav" shape="pill" blur={4}>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav__item"
              aria-current={item.id === view ? "page" : undefined}
              onClick={() => open(item.id)}
            >
              {item.label}
            </button>
          ))}
        </LiquidGlass>
      </nav>
      <main className="shell__main" key={view}>
        {view === "draft" && draft ? (
          <ChampSelectPage draft={draft} />
        ) : view === "about" ? (
          <About />
        ) : view === "settings" ? (
          <SettingsPage />
        ) : (
          <Home lcu={lcu} coaching={coaching} onCoach={setCoaching} />
        )}
      </main>
    </div>
  );
}

export default App;
