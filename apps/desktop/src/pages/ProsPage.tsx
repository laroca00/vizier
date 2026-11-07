import { useT } from "../i18n";
import { useState } from "react";
import { getProTeams, type ProGroup } from "../api";
import { roleIconUrl } from "../data/ddragon";
import { POSITIONS } from "../labels";
import { ProBuildList } from "../ProBuildList";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { Tabs } from "../ui/Tabs";
import { useAsync } from "../useAsync";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const ALL = "ALL";
const GROUPS: { id: ProGroup; label: string; note: string }[] = [
  { id: "worlds", label: "Worlds 2026", note: "LCK takımları ve BrokenBlade" },
  { id: "turkey", label: "Türk oyuncular", note: "TCL'de oynayan ve oynamış Türk oyuncular" },
  { id: "challenger", label: "Challenger", note: "KR, EUW ve TR'de en yüksek LP'li oyuncular, her gün güncellenir" },
];

export function ProsPage() {
  const t = useT();
  const [position, setPosition] = useState<string>(ALL);
  const [group, setGroup] = useState<ProGroup>("worlds");
  const [team, setTeam] = useState<string>(ALL);
  const [teams] = useAsync("pro-teams", getProTeams);
  const groupTeams = teams.status === "done" ? teams.value.filter((entry) => entry.group === group && entry.team) : [];

  return (
    <LiquidGlass className="panel tiers" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Pro build'ler")}
        subtitle={t("{who}, solo kuyruk maçları", { who: t(GROUPS.find((g) => g.id === group)?.note ?? "") })}
        toolbar={
          <Tabs
            label={t("Oyuncu grubu")}
            items={GROUPS.map((g) => ({ id: g.id, label: t(g.label) }))}
            value={group}
            onChange={(id) => {
              setGroup(id);
              setTeam(ALL);
            }}
          />
        }
      />

      <Tabs
        label={t("Rol")}
        size="small"
        items={[
          { id: ALL, label: t("Tüm roller") },
          ...ROLES.map((p) => ({ id: p, label: t(POSITIONS[p]), icon: <img className="role-icon" src={roleIconUrl(p)} alt="" width={16} height={16} /> })),
        ]}
        value={position}
        onChange={setPosition}
      />

      {groupTeams.length > 1 && (
        <Tabs
          label={t("Takım")}
          size="small"
          items={[{ id: ALL, label: t("Tüm takımlar") }, ...groupTeams.map((entry) => ({ id: entry.team, label: entry.team }))]}
          value={team}
          onChange={setTeam}
        />
      )}

      <ProBuildList
        filter={{ group, position: position === ALL ? undefined : position, team: team === ALL ? undefined : team, limit: 40 }}
        emptyText={t("Bu filtreyle henüz pro maçı yok. Vizier birkaç dakikada bir yeni maçları alıyor.")}
      />
    </LiquidGlass>
  );
}
