import { ClientStatus } from "../ClientStatus";
import { LiquidGlass } from "../ui/LiquidGlass";

export function Home() {
  return (
    <LiquidGlass className="panel welcome" radius={28} strength={2.5}>
      <h1 className="wordmark enter">Vizier</h1>
      <p className="welcome__line enter">TR sunucusu için League of Legends yardımcısı.</p>
      <ClientStatus className="enter" />
    </LiquidGlass>
  );
}
