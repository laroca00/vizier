import { useState } from "react";
import { About } from "./pages/About";
import { Home } from "./pages/Home";
import { LiquidGlass } from "./ui/LiquidGlass";
import { ShaderGradient } from "./ui/ShaderGradient";
import "./App.css";

// Night cobalt to turquoise across the plane, bright cobalt on the folds.
const GRADIENT: [string, string, string] = ["#0b1846", "#1c9c92", "#2f55c8"];

const PAGES = [
  { id: "home", label: "Ana sayfa", Component: Home },
  { id: "about", label: "Hakkında", Component: About },
] as const;

type PageId = (typeof PAGES)[number]["id"];

function App() {
  const [pageId, setPageId] = useState<PageId>("home");
  const [navigated, setNavigated] = useState(false);
  const page = PAGES.find((p) => p.id === pageId)!;

  function open(id: PageId) {
    if (id === pageId) return;
    setNavigated(true);
    setPageId(id);
  }

  return (
    <div className="shell" data-navigated={navigated || undefined}>
      <ShaderGradient className="shell__backdrop" colors={GRADIENT} strength={3} reflection={0.18} />
      <nav className="shell__nav" aria-label="Ana menü">
        <LiquidGlass className="nav" shape="pill" blur={4}>
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className="nav__item"
              aria-current={p.id === pageId ? "page" : undefined}
              onClick={() => open(p.id)}
            >
              {p.label}
            </button>
          ))}
        </LiquidGlass>
      </nav>
      <main className="shell__main" key={page.id}>
        <page.Component />
      </main>
    </div>
  );
}

export default App;
