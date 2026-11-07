import { ClientStatus } from "../ClientStatus";
import type { LcuStatus } from "../lcu";
import { MetaPicks } from "../MetaPicks";
import { ProBuildList } from "../ProBuildList";
import { useT } from "../i18n";
import { LiquidGlass } from "../ui/LiquidGlass";

type Props = {
  lcu: LcuStatus;
  onOpenChampion: (championId: number, position: string | null) => void;
};

// A plain start page until the new Home (roadmap phase 3) replaces it.
export function Home({ lcu, onOpenChampion }: Props) {
  const t = useT();
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
      <LiquidGlass className="panel home__pros" radius={28} strength={2.5} scroll>
        <h2 className="draft__heading">{t("Son pro build'ler")}</h2>
        <ProBuildList
          filter={{ limit: 6 }}
          compact
          emptyText={t("Bu filtreyle henüz pro maçı yok. Vizier birkaç dakikada bir yeni maçları alıyor.")}
        />
      </LiquidGlass>
    </div>
  );
}
