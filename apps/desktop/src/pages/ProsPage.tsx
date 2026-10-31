import { useState } from "react";
import { getProTeams } from "../api";
import { POSITIONS } from "../labels";
import { ProBuildList } from "../ProBuildList";
import { LiquidGlass } from "../ui/LiquidGlass";
import { useAsync } from "../useAsync";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

export function ProsPage() {
  const [position, setPosition] = useState<string | null>(null);
  const [team, setTeam] = useState<string | null>(null);
  const [teams] = useAsync("pro-teams", getProTeams);

  return (
    <LiquidGlass className="panel tiers" radius={28} strength={2.5}>
      <header className="draft__header">
        <h1 className="draft__title">Pro build'ler</h1>
        <p className="draft__phase">Worlds 2026 oyuncularının solo kuyruk maçları</p>
      </header>

      <div className="tiers__tabs" role="tablist" aria-label="Rol">
        <button type="button" role="tab" aria-selected={position === null} className="nav__item" onClick={() => setPosition(null)}>
          Tüm roller
        </button>
        {ROLES.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={p === position} className="nav__item" onClick={() => setPosition(p)}>
            {POSITIONS[p]}
          </button>
        ))}
      </div>

      {teams.status === "done" && teams.value.length > 1 && (
        <div className="tiers__tabs tiers__tabs--roles" role="tablist" aria-label="Takım">
          <button type="button" role="tab" aria-selected={team === null} className="nav__item" onClick={() => setTeam(null)}>
            Tüm takımlar
          </button>
          {teams.value.map((t) => (
            <button key={t.team} type="button" role="tab" aria-selected={t.team === team} className="nav__item" onClick={() => setTeam(t.team)}>
              {t.team}
            </button>
          ))}
        </div>
      )}

      <ProBuildList
        filter={{ position: position ?? undefined, team: team ?? undefined, limit: 40 }}
        emptyText="Bu filtreyle henüz pro maçı yok. Vizier birkaç dakikada bir yeni maçları alıyor."
      />
    </LiquidGlass>
  );
}
