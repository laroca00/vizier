import { useState } from "react";
import { ClientStatus } from "../ClientStatus";
import { matchFixture } from "../dev/fixtures";
import { CoachPanel } from "../CoachPanel";
import { platformOf, type LcuStatus } from "../lcu";
import { MatchDetail } from "../MatchDetail";
import { ProfileCard, type CoachTarget } from "../ProfileCard";
import { useT } from "../i18n";
import { LiquidGlass } from "../ui/LiquidGlass";

type Props = { lcu: LcuStatus; coaching: CoachTarget | null; onCoach: (target: CoachTarget | null) => void };

export function Home({ lcu, coaching, onCoach }: Props) {
  const t = useT();
  const fixture = matchFixture();
  const summoner =
    lcu.state === "connected" ? lcu.summoner : fixture ? { gameName: "", tagLine: "", puuid: fixture.puuid } : null;
  const [openMatch, setOpenMatch] = useState<string | null>(fixture?.matchId ?? null);

  let side = null;
  if (coaching) {
    side = <CoachPanel {...coaching} onClose={() => onCoach(null)} />;
  } else if (openMatch && summoner) {
    side = (
      <MatchDetail
        matchId={openMatch}
        puuid={summoner.puuid}
        onClose={() => setOpenMatch(null)}
        onCoach={() => onCoach({ matchId: openMatch, puuid: summoner.puuid, championName: "Bu" })}
      />
    );
  } else if (summoner) {
    side = (
      <ProfileCard
        summoner={summoner}
        platform={platformOf(lcu.state === "connected" ? lcu.region : null)}
        onCoach={onCoach}
        onOpenMatch={setOpenMatch}
      />
    );
  }

  return (
    <div className="home">
      <LiquidGlass className="panel welcome" radius={28} strength={2.5}>
        <h1 className="wordmark enter">Vizier</h1>
        <p className="welcome__line enter">{t("EUW ve TR oyuncuları için League of Legends yardımcısı.")}</p>
        <ClientStatus status={lcu} className="enter" />
      </LiquidGlass>
      {side}
    </div>
  );
}
