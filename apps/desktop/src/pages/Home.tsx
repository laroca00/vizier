import { ClientStatus } from "../ClientStatus";
import { CoachPanel } from "../CoachPanel";
import type { LcuStatus } from "../lcu";
import { ProfileCard, type CoachTarget } from "../ProfileCard";
import { LiquidGlass } from "../ui/LiquidGlass";

type Props = { lcu: LcuStatus; coaching: CoachTarget | null; onCoach: (target: CoachTarget | null) => void };

export function Home({ lcu, coaching, onCoach }: Props) {
  const summoner = lcu.state === "connected" ? lcu.summoner : null;
  return (
    <div className="home">
      <LiquidGlass className="panel welcome" radius={28} strength={2.5}>
        <h1 className="wordmark enter">Vizier</h1>
        <p className="welcome__line enter">TR sunucusu için League of Legends yardımcısı.</p>
        <ClientStatus status={lcu} className="enter" />
      </LiquidGlass>
      {coaching ? (
        <CoachPanel {...coaching} onClose={() => onCoach(null)} />
      ) : (
        summoner && <ProfileCard summoner={summoner} onCoach={onCoach} />
      )}
    </div>
  );
}
