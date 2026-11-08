import { useState } from "react";
import { championIconUrl, champions, itemIconUrl, latestVersion } from "../data/ddragon";
import { useLang, useT, type Lang } from "../i18n";
import "../library/library.css";
import { openExternal, PATCH_NOTES } from "../links";
import { direction, type EntityDiff, type Kind } from "../patches/diff";
import { patchDiff, patchName, patchVersions, type PatchDiff } from "../patches/load";
import "../patches/patches.css";
import { fieldLabel, formatValue } from "../patches/format";
import { usePersonal } from "../personal";
import { Button } from "../ui/Button";
import { FilterChips, SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { Tabs } from "../ui/Tabs";
import { useAsync } from "../useAsync";

type Category = "all" | Kind;
const CATEGORIES: { id: Category; label: string }[] = [
  { id: "all", label: "Hepsi" },
  { id: "champion", label: "Şampiyonlar" },
  { id: "item", label: "Eşyalar" },
  { id: "rune", label: "Rünler" },
];

export function PatchesPage({ onOpenChampion }: { onOpenChampion: (championId: number) => void }) {
  const t = useT();
  const lang = useLang();
  const [versions, retryVersions] = useAsync("patch-versions", patchVersions);
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const list = versions.status === "done" ? versions.value : [];
  const target = to ?? list[0] ?? null;
  const base = from ?? list[1] ?? null;
  const [diff, retry] = useAsync(base && target ? `patch-diff:${base}:${target}:${lang}` : null, () => patchDiff(base!, target!, lang));

  return (
    <LiquidGlass className="panel tiers patches" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Yama takibi")}
        subtitle={base && target ? t("{from} ile {to} arasında Data Dragon'da değişen değerler", { from: patchName(base), to: patchName(target) }) : undefined}
        toolbar={
          <Button variant="ghost" onClick={() => openExternal(PATCH_NOTES[lang])}>
            {t("Riot'un yama notları")}
          </Button>
        }
      />
      {versions.status === "error" ? (
        <ErrorState message={t("Yama listesi alınamadı.")} onRetry={retryVersions} />
      ) : versions.status !== "done" ? (
        <Skeleton lines={4} label={t("Yükleniyor")} />
      ) : (
        <>
          <div className="library__filters">
            <Select label={t("Eski")} value={base ?? ""} options={list.slice(1).map((v) => ({ value: v, label: v }))} onChange={setFrom} />
            <Select label={t("Yeni")} value={target ?? ""} options={list.map((v) => ({ value: v, label: v }))} onChange={setTo} />
          </div>
          <p className="build__note patches__limits">
            {t("Data Dragon temel değerleri, bekleme sürelerini, bedelleri, menzilleri, eşya değerlerini, fiyatları ve tarifleri yayınlar. Yetenek açıklamalarındaki hasar sayıları ve sistem değişiklikleri burada görünmez; onlar için Riot'un yama notlarına bak.")}
          </p>
          {base && target && base === target ? (
            <EmptyState title={t("Aynı sürüm seçili")}>{t("Karşılaştırmak için iki farklı sürüm seç.")}</EmptyState>
          ) : diff.status === "error" ? (
            <ErrorState message={t("Yama verisi alınamadı.")} onRetry={retry} />
          ) : diff.status !== "done" ? (
            <Skeleton lines={8} label={t("İki sürüm karşılaştırılıyor")} />
          ) : (
            <DiffView diff={diff.value} onOpenChampion={onOpenChampion} />
          )}
        </>
      )}
    </LiquidGlass>
  );
}

function DiffView({ diff, onOpenChampion }: { diff: PatchDiff; onOpenChampion: (championId: number) => void }) {
  const t = useT();
  const lang = useLang();
  const personal = usePersonal();
  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [statics] = useAsync("patch-statics", () => Promise.all([latestVersion(), champions()]));
  const version = statics.status === "done" ? statics.value[0] : null;
  const championIds = statics.status === "done" ? new Map([...statics.value[1].values()].map((c) => [String(c.key), c.id])) : new Map<string, string>();
  const mine = new Set([...personal.favourites, ...personal.pool.map((p) => p.championId)].map(String));

  const needle = query.trim().toLocaleLowerCase(lang);
  const shown = diff.entries.filter(
    (e) =>
      (category === "all" || e.kind === category) &&
      (!needle || e.name.toLocaleLowerCase(lang).includes(needle)) &&
      (!onlyFavourites || (e.kind === "champion" && mine.has(e.id))),
  );
  const count = (kind: Kind) => diff.entries.filter((e) => e.kind === kind).length;

  return (
    <>
      <div className="library__filters">
        <SearchInput label={t("Ara")} value={query} onChange={setQuery} placeholder={t("Şampiyon, eşya ya da rün ara")} />
        <FilterChips
          label={t("Favoriler")}
          chips={[{ id: "mine", label: t("Favorilerim ve havuzum") }]}
          selected={onlyFavourites ? ["mine"] : []}
          onChange={(s) => setOnlyFavourites(s.length > 0)}
        />
      </div>
      <Tabs
        label={t("Kategori")}
        size="small"
        items={CATEGORIES.map((c) => ({ id: c.id, label: c.id === "all" ? t(c.label) : `${t(c.label)} ${count(c.id)}` }))}
        value={category}
        onChange={setCategory}
      />
      {shown.length === 0 ? (
        <EmptyState title={diff.entries.length === 0 ? t("Data Dragon'da değişen değer yok") : t("Bu filtrelere uyan değişiklik yok")}>
          {diff.entries.length === 0 ? t("Bu iki sürüm arasındaki değişiklikler sayılarla yayınlanmamış olabilir; Riot'un yama notlarına bak.") : t("Bir filtreyi kaldırıp tekrar dene.")}
        </EmptyState>
      ) : (
        <ul className="patches__list">
          {shown.map((entry) => (
            <Entry
              key={`${entry.kind}:${entry.id}`}
              entry={entry}
              icon={
                version && entry.kind === "champion" && championIds.get(entry.id)
                  ? championIconUrl(version, championIds.get(entry.id)!)
                  : entry.kind === "item"
                    ? itemIconUrl(diff.to, Number(entry.id))
                    : null
              }
              itemNames={diff.itemNames}
              lang={lang}
              onOpen={entry.kind === "champion" && entry.status !== "removed" ? () => onOpenChampion(Number(entry.id)) : undefined}
            />
          ))}
        </ul>
      )}
    </>
  );
}

const STATUS: Record<EntityDiff["status"], string> = { added: "Yeni", removed: "Kaldırıldı", changed: "Değişti" };

function Entry({ entry, icon, itemNames, lang, onOpen }: { entry: EntityDiff; icon: string | null; itemNames: Record<string, string>; lang: Lang; onOpen?: () => void }) {
  const t = useT();
  const name = (
    <>
      {icon ? <img src={icon} alt="" width={36} height={36} loading="lazy" /> : <span className="patches__no-icon" />}
      <span className="library__name">{entry.name}</span>
    </>
  );
  return (
    <li className="patches__entry" data-status={entry.status}>
      <div className="patches__head">
        {onOpen ? (
          <button type="button" className="library__open" onClick={onOpen}>
            {name}
          </button>
        ) : (
          <span className="library__open">{name}</span>
        )}
        <span className="patches__status">{t(STATUS[entry.status])}</span>
      </div>
      {entry.changes.length > 0 && (
        <ul className="patches__changes">
          {entry.changes.map((change) => (
            <li key={change.field} data-direction={direction(change) ?? undefined}>
              <span>{fieldLabel(change.field, t)}</span>
              <span className="patches__values">
                {formatValue(change, change.before, itemNames, lang, t)} <span aria-hidden="true">→</span>
                <span className="visually-hidden">{t("şuna değişti:")}</span> {formatValue(change, change.after, itemNames, lang, t)}
                {direction(change) && <span className="visually-hidden">{direction(change) === "up" ? t("(güçlendirme)") : t("(zayıflatma)")}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
