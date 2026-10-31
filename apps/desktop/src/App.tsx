import { useEffect, useRef, useState } from "react";
import { champSelectFixture } from "./dev/fixtures";
import { useChampSelect, useLcuStatus } from "./lcu";
import { About } from "./pages/About";
import { ChampSelectPage } from "./pages/ChampSelectPage";
import { Home } from "./pages/Home";
import { LiquidGlass } from "./ui/LiquidGlass";
import { ShaderGradient } from "./ui/ShaderGradient";
import "./App.css";

// Night cobalt to turquoise across the plane, bright cobalt on the folds.
const GRADIENT: [string, string, string] = ["#0b1846", "#1c9c92", "#2f55c8"];

type View = "home" | "about" | "draft";

const fixture = champSelectFixture();

function App() {
  const lcu = useLcuStatus();
  const draft = useChampSelect() ?? fixture;
  const [view, setView] = useState<View>(draft ? "draft" : "home");
  const [navigated, setNavigated] = useState(false);
  const draftActive = useRef(draft !== null);

  // Jump to the draft when it starts and leave it when it ends, but don't
  // pull the player back if they switched away during it.
  useEffect(() => {
    const active = draft !== null;
    if (active && !draftActive.current) setView("draft");
    if (!active && draftActive.current) setView((v) => (v === "draft" ? "home" : v));
    draftActive.current = active;
  }, [draft]);

  const items: { id: View; label: string }[] = [
    { id: "home", label: "Ana sayfa" },
    ...(draft ? [{ id: "draft" as const, label: "Şampiyon seçimi" }] : []),
    { id: "about", label: "Hakkında" },
  ];

  function open(id: View) {
    if (id === view) return;
    setNavigated(true);
    setView(id);
  }

  return (
    <div className="shell" data-navigated={navigated || undefined}>
      <ShaderGradient className="shell__backdrop" colors={GRADIENT} strength={3} reflection={0.18} />
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
        ) : (
          <Home lcu={lcu} />
        )}
      </main>
    </div>
  );
}

export default App;
