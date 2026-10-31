import { LiquidGlass } from "./ui/LiquidGlass";
import { ShaderGradient } from "./ui/ShaderGradient";
import "./App.css";

// Night cobalt to turquoise across the plane, bright cobalt on the folds.
const GRADIENT: [string, string, string] = ["#0b1846", "#1c9c92", "#2f55c8"];

function App() {
  return (
    <div className="shell">
      <ShaderGradient className="shell__backdrop" colors={GRADIENT} strength={3} reflection={0.18} />
      <main className="shell__main">
        <LiquidGlass className="welcome" radius={28} strength={2.5}>
          <h1 className="wordmark">Vizier</h1>
          <p className="welcome__line">TR sunucusu için League of Legends yardımcısı.</p>
          <LiquidGlass className="status" shape="pill" blur={3} role="status">
            <span className="status__dot" aria-hidden="true" />
            League istemcisine bağlı değil
          </LiquidGlass>
        </LiquidGlass>
      </main>
      <footer className="shell__legal" lang="en">
        Vizier isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone
        officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties
        are trademarks or registered trademarks of Riot Games, Inc.
      </footer>
    </div>
  );
}

export default App;
