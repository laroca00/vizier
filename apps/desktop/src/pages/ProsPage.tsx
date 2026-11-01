import { useT } from "../i18n";
import { useState } from "react";
import { getProTeams, type ProGroup } from "../api";
import { roleIconUrl } from "../data/ddragon";
import { POSITIONS } from "../labels";
import { ProBuildList } from "../ProBuildList";
import { LiquidGlass } from "../ui/LiquidGlass";
import { useAsync } from "../useAsync";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const GROUPS: { id: ProGroup; label: string; note: string }[] = [
  { id: "worlds", label: "Worlds 2026", note: "LCK takımları ve BrokenBlade" },
  { id: "turkey", label: "Türk oyuncular", note: "TCL'de oynayan ve oynamış Türk oyuncular" },
];

export function ProsPage() {
  const t = useT();
  const [position, setPosition] = useState<string | null>(null);
  const [group, setGroup] = useState<ProGroup>("worlds");
  const [team, setTeam] = useState<string | null>(null);
  const [teams] = useAsync("pro-teams", getProTeams);

  return (
    <LiquidGlass className="panel tiers" radius={28} strength={2.5} scroll>
      <header className="draft__header">
        <h1 className="draft__title">{t("Pro build'ler")}</h1>
        <p className="draft__phase">{t("{who}, solo kuyruk maçları", { who: t(GROUPS.find((g) => g.id === group)?.note ?? "") })}</p>
      </header>

      <div className="tiers__tabs" role="tablist" aria-label={t("Oyuncu grubu")}>
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === group}
            className="nav__item"
            onClick={() => {
              setGroup(g.id);
              setTeam(null);
            }}
          >
            {t(g.label)}
          </button>
        ))}
      </div>

      <div className="tiers__tabs tiers__tabs--roles" role="tablist" aria-label={t("Rol")}>
        <button type="button" role="tab" aria-selected={position === null} className="nav__item" onClick={() => setPosition(null)}>
          {t("Tüm roller")}
        </button>
        {ROLES.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={p === position} className="nav__item" onClick={() => setPosition(p)}>
            <img className="role-icon" src={roleIconUrl(p)} alt="" width={16} height={16} />
            {t(POSITIONS[p])}
          </button>
        ))}
      </div>

      {teams.status === "done" && teams.value.filter((t) => t.group === group && t.team).length > 1 && (
        <div className="tiers__tabs tiers__tabs--roles" role="tablist" aria-label={t("Takım")}>
          <button type="button" role="tab" aria-selected={team === null} className="nav__item" onClick={() => setTeam(null)}>
            {t("Tüm takımlar")}
          </button>
          {teams.value
            .filter((t) => t.group === group && t.team)
            .map((t) => (
            <button key={t.team} type="button" role="tab" aria-selected={t.team === team} className="nav__item" onClick={() => setTeam(t.team)}>
              {t.team}
            </button>
          ))}
        </div>
      )}

      <ProBuildList
        filter={{ group, position: position ?? undefined, team: team ?? undefined, limit: 40 }}
        emptyText={t("Bu filtreyle henüz pro maçı yok. Vizier birkaç dakikada bir yeni maçları alıyor.")}
      />
    </LiquidGlass>
  );
}
