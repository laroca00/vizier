import { useState } from "react";
import { ClientStatus } from "../ClientStatus";
import { CoachPanel } from "../CoachPanel";
import { Dashboard } from "../Dashboard";
import { matchFixture } from "../dev/fixtures";
import { platformOf, type LcuStatus } from "../lcu";
import { MatchDetail } from "../MatchDetail";
import { MetaPicks } from "../MetaPicks";
import { ProBuildList } from "../ProBuildList";
import type { CoachTarget } from "../ProfileCard";
import { useT } from "../i18n";
import { LiquidGlass } from "../ui/LiquidGlass";

type Props = {
  lcu: LcuStatus;
  coaching: CoachTarget | null;
  onCoach: (target: CoachTarget | null) => void;
  onOpenChampion: (championId: number, position: string | null) => void;
};

export function Home({ lcu, coaching, onCoach, onOpenChampion }: Props) {
  const t = useT();
  const fixture = matchFixture();
  const summoner = lcu.state === "connected" ? lcu.summoner : null;
  const puuid = summoner?.puuid ?? fixture?.puuid ?? null;
  const [openMatch, setOpenMatch] = useState<string | null>(fixture?.matchId ?? null);

  let drawer = null;
  if (coaching) {
    drawer = <CoachPanel {...coaching} onClose={() => onCoach(null)} />;
  } else if (openMatch && puuid) {
    drawer = (
      <MatchDetail
        matchId={openMatch}
        puuid={puuid}
        onClose={() => setOpenMatch(null)}
        onCoach={() => onCoach({ matchId: openMatch, puuid, championName: "Bu" })}
      />
    );
  }

  if (summoner) {
    return (
      <div className="home home--dash">
        <header className="dash__bar enter">
          <h1 className="wordmark wordmark--small">Vizier</h1>
          <ClientStatus status={lcu} />
        </header>
        <Dashboard
          summoner={summoner}
          platform={platformOf(lcu.state === "connected" ? lcu.region : null)}
          refreshKey={lcu.state === "connected" ? lcu.lastGameId : null}
          onCoach={onCoach}
          onOpenMatch={setOpenMatch}
          onOpenChampion={onOpenChampion}
        />
        {drawer && <div className="dash__drawer">{drawer}</div>}
      </div>
    );
  }

  // Without a summoner the side shows what the pros are building instead of an empty space.
  const side = drawer ?? (
    <LiquidGlass className="panel home__pros" radius={28} strength={2.5} scroll>
      <h2 className="draft__heading">{t("Son pro build'ler")}</h2>
      <ProBuildList
        filter={{ limit: 6 }}
        compact
        emptyText={t("Bu filtreyle henüz pro maçı yok. Vizier birkaç dakikada bir yeni maçları alıyor.")}
      />
    </LiquidGlass>
  );

  return (
    <div className="home">
      <div className="home__hero">
        <header className="welcome">
          <h1 className="wordmark enter">Vizier</h1>
          <p className="welcome__line enter">{t("EUW ve TR oyuncuları için League of Legends yardımcısı.")}</p>
          <ClientStatus status={lcu} className="enter" />
        </header>
        <MetaPicks onOpenChampion={onOpenChampion} />
      </div>
      {side}
    </div>
  );
}
