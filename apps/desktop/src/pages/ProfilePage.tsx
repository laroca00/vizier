import { useState } from "react";
import { CoachPanel } from "../CoachPanel";
import { PublicDashboard } from "../Dashboard";
import { useT } from "../i18n";
import { MatchDetail } from "../MatchDetail";
import type { CoachTarget } from "../ProfileCard";
import type { RiotId } from "../SearchPalette";

/** Someone else's profile, opened from search. */
export function ProfilePage({ riotId, onOpenChampion }: { riotId: RiotId; onOpenChampion: (championId: number, position: string | null) => void }) {
  const t = useT();
  const [openMatch, setOpenMatch] = useState<{ matchId: string; puuid: string } | null>(null);
  const [coaching, setCoaching] = useState<CoachTarget | null>(null);

  let drawer = null;
  if (coaching) {
    drawer = <CoachPanel {...coaching} onClose={() => setCoaching(null)} />;
  } else if (openMatch) {
    drawer = (
      <MatchDetail
        matchId={openMatch.matchId}
        puuid={openMatch.puuid}
        onClose={() => setOpenMatch(null)}
        onCoach={() => setCoaching({ ...openMatch, championName: "Bu" })}
      />
    );
  }

  return (
    <div className="home home--dash">
      <header className="dash__bar enter">
        <h1 className="page__title">
          {riotId.gameName}
          <span className="profile__tag">#{riotId.tagLine}</span>
        </h1>
        <p className="tile__meta">{t("Arama sonucu")}</p>
      </header>
      <PublicDashboard
        summoner={{ gameName: riotId.gameName, tagLine: riotId.tagLine, puuid: "" }}
        platform={riotId.platform}
        onCoach={setCoaching}
        onOpenMatch={(matchId, puuid) => setOpenMatch({ matchId, puuid })}
        onOpenChampion={onOpenChampion}
      />
      {drawer && <div className="dash__drawer">{drawer}</div>}
    </div>
  );
}
