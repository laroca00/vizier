import { useState } from "react";
import { getBuildIndex } from "../api";
import { ARCHETYPES, archetypesOf, type ArchetypeId, type TeamRole } from "../data/archetypes";
import { matchChampions } from "../data/archetypeSearch";
import { championIconUrl, champions, latestVersion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { loadErrorMessage } from "../loadError";
import { useOnline } from "../useOnline";
import { useAsync } from "../useAsync";
import { DataBadge } from "../ui/DataBadge";
import { FilterChips, SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import "./ArchetypesPage.css";

const ROLE_TEXT: Record<TeamRole, string> = { front: "Ön hat", damage: "Hasar", support: "Destek", flex: "Esnek" };
const ANY = "ANY";

/** Browse champions by what kind of player they are, and combine kinds to find fits. */
export function ArchetypesPage({ onOpenChampion }: { onOpenChampion: (championId: number, position: string | null) => void }) {
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const [data, retry] = useAsync("archetypes-static", async () => ({ version: await latestVersion(), list: await champions() }));
  // The role filter needs the crawler's index; without it the filter is simply not offered.
  const [index] = useAsync("archetypes-index", () => getBuildIndex().catch(() => null));
  const [selected, setSelected] = useState<ArchetypeId[]>([]);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState(ANY);

  const byId = data.status === "done" ? new Map([...data.value.list.values()].map((c) => [c.id, c])) : new Map();
  const rolesAvailable = index.status === "done" && !!index.value && index.value.builds.length > 0;
  const keyToId = data.status === "done" ? new Map([...data.value.list.values()].map((c) => [c.key, c.id])) : new Map<number, string>();
  const inRole =
    rolesAvailable && position !== ANY && index.status === "done" && index.value
      ? new Set(index.value.builds.filter((b) => b.position === position).map((b) => keyToId.get(b.championId)).filter((id): id is string => !!id))
      : null;
  const matches = matchChampions({ archetypes: selected, query, inRole }, (id) => byId.get(id)?.name ?? id).filter((id) => byId.has(id));
  matches.sort((a, b) => byId.get(a)!.name.localeCompare(byId.get(b)!.name, lang));

  return (
    <LiquidGlass className="panel tiers archetypes" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Şampiyon tipleri")} subtitle={t("Bir tipi seç ya da birkaçını birleştir; hepsine uyan şampiyonlar altta listelenir.")} />
      {data.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(data.error, online))} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <>
          <FilterChips
            label={t("Şampiyon tipi")}
            chips={ARCHETYPES.map((a) => ({ id: a.id, label: a.name[lang] }))}
            selected={selected}
            onChange={setSelected}
          />
          <div className="library__filters">
            <SearchInput label={t("Şampiyon ara")} value={query} onChange={setQuery} placeholder={t("Şampiyon ara")} />
            {rolesAvailable && (
              <Select
                label={t("Rol")}
                value={position}
                options={[{ value: ANY, label: t("Hepsi") }, ...Object.entries(POSITIONS).map(([value, label]) => ({ value, label: t(label) }))]}
                onChange={setPosition}
              />
            )}
          </div>
          {selected.length > 0 && (
            <ul className="archetypes__about">
              {selected.map((id) => {
                const a = ARCHETYPES.find((x) => x.id === id)!;
                return (
                  <li key={id}>
                    <strong>{a.name[lang]}</strong> · {t(ROLE_TEXT[a.role])}
                    <p>{a.description[lang]}</p>
                    <p className="build__stat">
                      {a.strength[lang]} · {a.weakness[lang]}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="build__stat">
            {t("{count} şampiyon", { count: matches.length })} <DataBadge editorial source={t("Vizier'in elle yazdığı bir değerlendirme; maç verisi değil.")} />
          </p>
          {matches.length === 0 ? (
            <EmptyState title={t("Bu birleşime uyan şampiyon yok")}>{t("Bir tipi kaldırmayı ya da aramayı değiştirmeyi dene.")}</EmptyState>
          ) : (
            <ul className="archetypes__grid">
              {matches.map((id) => {
                const champion = byId.get(id)!;
                return (
                  <li key={id}>
                    <button type="button" className="archetypes__champion" onClick={() => onOpenChampion(champion.key, position === ANY ? null : position)}>
                      <img src={championIconUrl(data.value.version, champion.id)} alt="" width={36} height={36} loading="lazy" />
                      <span className="archetypes__name">{champion.name}</span>
                      <span className="build__stat">{archetypesOf(id).map((a) => a.name[lang]).join(", ")}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </LiquidGlass>
  );
}
