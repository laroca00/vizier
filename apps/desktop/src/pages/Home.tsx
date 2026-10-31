import { ClientStatus } from "../ClientStatus";
import type { LcuStatus } from "../lcu";
import { ProfileCard } from "../ProfileCard";
import { LiquidGlass } from "../ui/LiquidGlass";

export function Home({ lcu }: { lcu: LcuStatus }) {
  const summoner = lcu.state === "connected" ? lcu.summoner : null;
  return (
    <div className="home">
      <LiquidGlass className="panel welcome" radius={28} strength={2.5}>
        <h1 className="wordmark enter">Vizier</h1>
        <p className="welcome__line enter">TR sunucusu için League of Legends yardımcısı.</p>
        <ClientStatus status={lcu} className="enter" />
      </LiquidGlass>
      {summoner && <ProfileCard summoner={summoner} />}
    </div>
  );
}
