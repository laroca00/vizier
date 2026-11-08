import { useT } from "../i18n";
import { useState } from "react";
import { getProPatches, getProTeams, type ProGroup } from "../api";
import { champions, roleIconUrl } from "../data/ddragon";
import { POSITIONS } from "../labels";
import { ProBuildList } from "../ProBuildList";
import { Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { Tabs } from "../ui/Tabs";
import { useAsync } from "../useAsync";
import "./ProsPage.css";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const ALL = "ALL";
const GROUPS: { id: ProGroup; label: string; note: string }[] = [
  { id: "worlds", label: "Worlds 2026", note: "LCK takımları ve BrokenBlade" },
  { id: "turkey", label: "Türk oyuncular", note: "TCL'de oynayan ve oynamış Türk oyuncular" },
  { id: "challenger", label: "Challenger", note: "KR, EUW ve TR'de en yüksek LP'li oyuncular, her gün güncellenir" },
];
const REGIONS = [
  { value: "kr", label: "KR" },
  { value: "euw1", label: "EUW" },
  { value: "tr1", label: "TR" },
  { value: "na1", label: "NA" },
];

const pick = (value: string) => (value === ALL ? undefined : value);

export function ProsPage() {
  const t = useT();
  const [position, setPosition] = useState<string>(ALL);
  const [group, setGroup] = useState<ProGroup>("worlds");
  const [team, setTeam] = useState<string>(ALL);
  const [player, setPlayer] = useState<string>(ALL);
  const [champion, setChampion] = useState<string>(ALL);
  const [region, setRegion] = useState<string>(ALL);
  const [patch, setPatch] = useState<string>(ALL);
  const [teams] = useAsync("pro-teams", getProTeams);
  const [patches] = useAsync("pro-patches", getProPatches);
  const [championList] = useAsync("champions", champions);
  const groupTeams = teams.status === "done" ? teams.value.filter((entry) => entry.group === group && entry.team) : [];
  const players = [...new Set((team === ALL ? groupTeams : groupTeams.filter((e) => e.team === team)).flatMap((e) => e.players))].sort((a, b) => a.localeCompare(b));
  const championOptions = championList.status === "done" ? [...championList.value.values()].sort((a, b) => a.name.localeCompare(b.name, "tr")) : [];
  const all = { value: ALL, label: t("Hepsi") };

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
              setPlayer(ALL);
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

      <div className="pros__filters">
        <Select label={t("Şampiyon")} value={champion} options={[all, ...championOptions.map((c) => ({ value: String(c.key), label: c.name }))]} onChange={setChampion} />
        {groupTeams.length > 1 && (
          <Select
            label={t("Takım")}
            value={team}
            options={[all, ...groupTeams.map((entry) => ({ value: entry.team, label: entry.team }))]}
            onChange={(value) => {
              setTeam(value);
              setPlayer(ALL);
            }}
          />
        )}
        {players.length > 1 && <Select label={t("Oyuncu")} value={player} options={[all, ...players.map((p) => ({ value: p, label: p }))]} onChange={setPlayer} />}
        <Select label={t("Bölge")} value={region} options={[all, ...REGIONS]} onChange={setRegion} />
        {patches.status === "done" && patches.value.length > 0 && (
          <Select label={t("Yama")} value={patch} options={[all, ...patches.value.map((p) => ({ value: p, label: p }))]} onChange={setPatch} />
        )}
      </div>

      <ProBuildList
        filter={{
          group,
          position: pick(position),
          team: pick(team),
          player: pick(player),
          championId: champion === ALL ? undefined : Number(champion),
          platform: pick(region),
          patch: pick(patch),
          limit: 40,
        }}
        emptyText={t("Bu filtrelerle pro maçı yok. Bir filtreyi kaldır ya da başka bir grup seç.")}
      />
    </LiquidGlass>
  );
}
