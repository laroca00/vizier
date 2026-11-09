import { useState } from "react";
import { ComboCard } from "../combos/ComboCard";
import { CATEGORY_TEXT, COMBO_CATEGORIES, COMBOS, type ComboCategory } from "../data/combos";
import { championIconUrl, champions, latestVersion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { loadErrorMessage } from "../loadError";
import { useOnline } from "../useOnline";
import { FilterChips, SearchInput } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import "../combos/combos.css";

const norm = (text: string) => text.toLocaleLowerCase("tr").normalize("NFD").replace(/\p{M}/gu, "");

/** Every written-up combo with search and category filters. */
export function CombosPage({ onOpenChampion }: { onOpenChampion: (championId: number) => void }) {
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const [data, retry] = useAsync("combos-static", async () => ({ version: await latestVersion(), list: await champions() }));
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<ComboCategory[]>([]);

  const byId = data.status === "done" ? new Map([...data.value.list.values()].map((c) => [c.id, c])) : new Map();
  const needle = norm(query.trim());
  const groups = COMBOS.champions
    .map((entry) => ({
      champion: byId.get(entry.championId),
      combos: entry.combos.filter(
        (combo) =>
          (categories.length === 0 || categories.includes(combo.category)) &&
          (!needle || norm(`${byId.get(entry.championId)?.name ?? entry.championId} ${combo.name[lang]} ${combo.purpose[lang]}`).includes(needle)),
      ),
    }))
    .filter((g) => g.champion && g.combos.length > 0)
    .sort((a, b) => a.champion!.name.localeCompare(b.champion!.name, lang));

  return (
    <LiquidGlass className="panel tiers" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Kombo kütüphanesi")} subtitle={t("Yetenek sıraları, ne zaman kullanılacağı ve sık yapılan hatalar. Hepsini Vizier elle yazdı.")} />
      {data.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(data.error, online))} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <>
          <div className="library__filters">
            <SearchInput label={t("Şampiyon ya da kombo ara")} value={query} onChange={setQuery} placeholder={t("Şampiyon ya da kombo ara")} />
          </div>
          <FilterChips
            label={t("Kategori")}
            chips={COMBO_CATEGORIES.map((id) => ({ id, label: t(CATEGORY_TEXT[id]) }))}
            selected={categories}
            onChange={setCategories}
          />
          {groups.length === 0 ? (
            <EmptyState title={t("Kombo bulunamadı")}>{t("Aramayı ya da kategori seçimini değiştir.")}</EmptyState>
          ) : (
            <div className="combos__list">
              {groups.map(({ champion, combos }) => (
                <section key={champion!.id} className="combos__group" aria-label={champion!.name}>
                  <h2 className="draft__heading combos__champion">
                    <img src={championIconUrl(data.value.version, champion!.id)} alt="" width={28} height={28} />
                    <button type="button" className="matchups__open" onClick={() => onOpenChampion(champion!.key)}>
                      {champion!.name}
                    </button>
                  </h2>
                  {combos.map((combo) => (
                    <ComboCard key={combo.id} champion={champion!} version={data.value.version} combo={combo} patch={COMBOS.writtenFor} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </LiquidGlass>
  );
}
