import { useState } from "react";
import { CoachPanel } from "../CoachPanel";
import { MatchDetail } from "../MatchDetail";
import { ProfileCard, type CoachTarget } from "../ProfileCard";
import type { RiotId } from "../SearchPalette";

/** Someone else's profile, opened from search. */
export function ProfilePage({ riotId }: { riotId: RiotId }) {
  const [openMatch, setOpenMatch] = useState<{ matchId: string; puuid: string } | null>(null);
  const [coaching, setCoaching] = useState<CoachTarget | null>(null);

  let side = null;
  if (coaching) {
    side = <CoachPanel {...coaching} onClose={() => setCoaching(null)} />;
  } else if (openMatch) {
    side = (
      <MatchDetail
        matchId={openMatch.matchId}
        puuid={openMatch.puuid}
        onClose={() => setOpenMatch(null)}
        onCoach={() => setCoaching({ ...openMatch, championName: "Bu" })}
      />
    );
  }

  return (
    <div className="home">
      <ProfileCard
        summoner={{ ...riotId, puuid: "" }}
        onCoach={setCoaching}
        onOpenMatch={(matchId, puuid) => setOpenMatch({ matchId, puuid })}
      />
      {side}
    </div>
  );
}
