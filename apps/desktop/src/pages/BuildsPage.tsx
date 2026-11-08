import { useState } from "react";
import { getBuild, getBuildIndex, type BuildIndexEntry, type BuildStyle } from "../api";
import { STYLE_NAMES } from "../buildStyles";
import { championIconUrl, itemIconUrl, roleIconUrl, runeIconUrl } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS, positionLabel } from "../labels";
import { BuildEditor } from "../library/BuildEditor";
import { fromPicks } from "../library/convert";
import { sortBuilds, tagCounts, type LibrarySort } from "../library/organize";
import { readShareCode } from "../library/share";
import { loadLibraryData, type LibraryData } from "../library/data";
import "../library/library.css";
import { SavedBuildView } from "../library/SavedBuildView";
import { addCollection, createBuild, removeCollection, saveBuild, useLibrary, type SavedBuild } from "../library/store";
import { Button } from "../ui/Button";
import { SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { Tabs } from "../ui/Tabs";
import { useToast } from "../ui/Toast";
import { useAsync } from "../useAsync";

type View = "explore" | "mine";
const ALL = "ALL";
const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const SHOWN_RESULTS = 60;

type Props = { onOpenChampion: (championId: number, position: string | null) => void };

export function BuildsPage({ onOpenChampion }: Props) {
  const t = useT();
  const [view, setView] = useState<View>("explore");
  const [data] = useAsync("library-data", loadLibraryData);
  const library = useLibrary();

  return (
    <LiquidGlass className="panel tiers library" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Build kütüphanesi")}
        subtitle={view === "explore" ? t("Emerald+ maçlarından her şampiyon ve rol için önerilen build") : t("{count} kayıtlı build, bu bilgisayarda", { count: library.builds.length })}
        toolbar={
          <Tabs
            label={t("Görünüm")}
            items={[
              { id: "explore" as View, label: t("Keşfet") },
              { id: "mine" as View, label: t("Buildlerim") },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />
      {data.status === "error" ? (
        <ErrorState message={t("Oyun verisi alınamadı.")} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : view === "explore" ? (
        <Explore data={data.value} onOpenChampion={onOpenChampion} onSaved={() => setView("mine")} />
      ) : (
        <Mine data={data.value} />
      )}
    </LiquidGlass>
  );
}

type Sort = "games" | "winRate";

function Explore({ data, onOpenChampion, onSaved }: { data: LibraryData; onOpenChampion: Props["onOpenChampion"]; onSaved: () => void }) {
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const [index, retry] = useAsync("build-index", getBuildIndex);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(ALL);
  const [style, setStyle] = useState(ALL);
  const [keystone, setKeystone] = useState(ALL);
  const [item, setItem] = useState(ALL);
  const [sort, setSort] = useState<Sort>("games");
  const [saving, setSaving] = useState<string | null>(null);
  const builds = index.status === "done" ? index.value.builds : [];

  // Options only list what some build actually has, so no filter leads nowhere by itself.
  const options = (() => {
    const styles = new Set<BuildStyle>();
    const keystones = new Set<number>();
    const items = new Set<number>();
    for (const b of builds) {
      b.styles.forEach((s) => styles.add(s));
      if (b.keystone) keystones.add(b.keystone);
      b.items.forEach((i) => items.add(i));
    }
    const byName = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, "tr");
    return {
      styles: [...styles].map((s) => ({ value: s as string, label: t(STYLE_NAMES[s]) })).sort(byName),
      keystones: [...keystones].map((k) => ({ value: String(k), label: data.runes.get(k)?.name ?? String(k) })).sort(byName),
      items: [...items].filter((i) => data.items.get(i)?.complete).map((i) => ({ value: String(i), label: data.items.get(i)?.name ?? String(i) })).sort(byName),
    };
  })();

  const needle = query.trim().toLocaleLowerCase("tr");
  const results = builds
    .filter(
      (b) =>
        (role === ALL || b.position === role) &&
        (style === ALL || b.styles.includes(style as BuildStyle)) &&
        (keystone === ALL || b.keystone === Number(keystone)) &&
        (item === ALL || b.items.includes(Number(item))) &&
        (!needle || (data.champions.get(b.championId)?.name.toLocaleLowerCase("tr").includes(needle) ?? false)),
    )
    .sort((a, b) => (sort === "games" ? b.games - a.games : b.winRate - a.winRate));

  async function save(entry: BuildIndexEntry) {
    const key = `${entry.championId}:${entry.position}`;
    setSaving(key);
    try {
      const build = await getBuild(entry.championId, entry.position);
      const champion = data.champions.get(entry.championId);
      if (!build || !champion) throw new Error("missing");
      createBuild(
        fromPicks(
          { name: `${champion.name} ${positionLabel(entry.position, lang) ?? ""}`.trim(), championId: entry.championId, position: entry.position },
          build,
          (id) => !!data.items.get(id)?.complete,
        ),
      );
      toast("success", t("{champion} buildlerine kaydedildi", { champion: champion.name }));
      onSaved();
    } catch {
      toast("error", t("Build alınamadı. İnternet bağlantını kontrol edip tekrar dene."));
    } finally {
      setSaving(null);
    }
  }

  if (index.status === "error") {
    return (
      <EmptyState title={t("Build araması şu an kullanılamıyor")} action={<Button onClick={retry}>{t("Tekrar dene")}</Button>}>
        {t("Sunucu build dizinini henüz yayınlamadı. Tek bir şampiyonun build'ini tier listesinden açabilirsin.")}
      </EmptyState>
    );
  }
  if (index.status !== "done") return <Skeleton lines={8} label={t("Yükleniyor")} />;

  return (
    <>
      <div className="library__filters">
        <SearchInput label={t("Şampiyon ara")} value={query} onChange={setQuery} placeholder={t("Şampiyon ara")} />
        <Select label={t("Tarz")} value={style} options={[{ value: ALL, label: t("Hepsi") }, ...options.styles]} onChange={setStyle} />
        <Select label={t("Temel rün")} value={keystone} options={[{ value: ALL, label: t("Hepsi") }, ...options.keystones]} onChange={setKeystone} />
        <Select label={t("Eşya")} value={item} options={[{ value: ALL, label: t("Hepsi") }, ...options.items]} onChange={setItem} />
        <Select
          label={t("Sırala")}
          value={sort}
          options={[
            { value: "games" as Sort, label: t("En çok oynanan") },
            { value: "winRate" as Sort, label: t("En yüksek kazanma") },
          ]}
          onChange={setSort}
        />
      </div>
      <Tabs
        label={t("Rol")}
        size="small"
        items={[
          { id: ALL, label: t("Tüm roller") },
          ...ROLES.map((p) => ({ id: p, label: t(POSITIONS[p]), icon: <img className="role-icon" src={roleIconUrl(p)} alt="" width={16} height={16} /> })),
        ]}
        value={role}
        onChange={setRole}
      />
      <p className="build__note">
        {t("{count} build, yama {patch}", { count: results.length, patch: index.value.patches[0] ?? "" })}
      </p>
      {results.length === 0 ? (
        <EmptyState title={t("Bu filtrelere uyan build yok")}>{t("Bir filtreyi kaldırıp tekrar dene.")}</EmptyState>
      ) : (
        <ul className="library__rows">
          {results.slice(0, SHOWN_RESULTS).map((b) => {
            const champion = data.champions.get(b.championId);
            const rune = b.keystone ? data.runes.get(b.keystone) : undefined;
            const key = `${b.championId}:${b.position}`;
            return (
              <li key={key} className="library__row">
                <button type="button" className="library__open" onClick={() => onOpenChampion(b.championId, b.position)}>
                  {champion && <img src={championIconUrl(data.version, champion.id)} alt="" width={36} height={36} />}
                  <span className="library__who">
                    <span className="library__name">{champion?.name}</span>
                    <span className="build__stat">{positionLabel(b.position, lang)}</span>
                  </span>
                </button>
                {rune ? <img className="library__keystone" src={runeIconUrl(rune.icon)} alt={rune.name} title={rune.name} width={28} height={28} /> : <span />}
                <span className="library__items">
                  {b.items
                    .filter((id) => data.items.get(id)?.complete)
                    .slice(0, 5)
                    .map((id) => (
                      <img key={id} src={itemIconUrl(data.version, id)} alt={data.items.get(id)?.name ?? ""} title={data.items.get(id)?.name} width={26} height={26} />
                    ))}
                </span>
                <span className="library__stats">
                  {formatPercent(b.winRate, lang, 1)}
                  <span className="build__stat">{t("{games} maç", { games: b.games })}</span>
                </span>
                <Button size="small" busy={saving === key} onClick={() => save(b)}>
                  {t("Kaydet")}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {results.length > SHOWN_RESULTS && <p className="build__note">{t("İlk {count} sonuç gösteriliyor; aramayı daralt.", { count: SHOWN_RESULTS })}</p>}
    </>
  );
}

const FAVOURITES = "__favourites";

function Mine({ data }: { data: LibraryData }) {
  const t = useT();
  const toast = useToast();
  const library = useLibrary();
  const [filter, setFilter] = useState<string>(ALL);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<SavedBuild | null>(null);
  const [newCollection, setNewCollection] = useState("");
  const [newChampion, setNewChampion] = useState<string>("");
  const [code, setCode] = useState("");

  const [sort, setSort] = useState<LibrarySort>("edited");
  const [tag, setTag] = useState("");
  const tags = tagCounts(library.builds);
  const lang = useLang();
  const shown = sortBuilds(
    library.builds.filter((b) => (filter === ALL ? true : filter === FAVOURITES ? b.favourite : b.collections.includes(filter)) && (!tag || (b.tags ?? []).includes(tag))),
    sort,
    (id) => data.champions.get(id)?.name ?? "",
    lang,
  );
  const current = library.builds.find((b) => b.id === selected) ?? shown[0] ?? null;
  const championOptions = [...data.champions.values()].sort((a, b) => a.name.localeCompare(b.name, "tr")).map((c) => ({ value: String(c.key), label: c.name }));

  async function startNew() {
    const championId = Number(newChampion || championOptions[0]?.value);
    const champion = data.champions.get(championId);
    if (!champion) return;
    const stats = await getBuild(championId, null).catch(() => null);
    const base = { name: t("Yeni {champion} build'i", { champion: champion.name }), championId, position: null };
    const draft = stats
      ? fromPicks(base, stats, (id) => !!data.items.get(id)?.complete)
      : { ...fromPicks(base, { runes: [], spells: [], items: [], startItems: null, coreItems: null, skills: null }, () => false), source: "custom" as const };
    setEditing({ ...draft, id: "", createdAt: 0, updatedAt: 0, collections: filter !== ALL && filter !== FAVOURITES ? [filter] : [] });
  }

  function onSave(build: SavedBuild) {
    if (build.id) saveBuild(build);
    else {
      const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = build;
      setSelected(createBuild(draft).id);
    }
    setEditing(null);
    toast("success", t("{name} kaydedildi", { name: build.name }));
  }

  const isCustom = filter !== ALL && filter !== FAVOURITES;

  return (
    <div className="library__mine">
      <div className="library__filters">
        <Tabs
          label={t("Koleksiyon")}
          size="small"
          items={[
            { id: ALL, label: t("Hepsi") },
            { id: FAVOURITES, label: t("Favoriler") },
            ...library.collections.map((c) => ({ id: c, label: t(c) })),
          ]}
          value={filter}
          onChange={setFilter}
        />
        <form
          className="library__collection-form"
          onSubmit={(e) => {
            e.preventDefault();
            addCollection(newCollection);
            setNewCollection("");
          }}
        >
          <input className="text-input" aria-label={t("Yeni koleksiyon")} placeholder={t("Yeni koleksiyon")} value={newCollection} maxLength={24} onChange={(e) => setNewCollection(e.target.value)} />
          <Button size="small" type="submit" disabled={!newCollection.trim()}>
            {t("Ekle")}
          </Button>
        </form>
        {isCustom && (
          <Button
            size="small"
            variant="ghost"
            onClick={() => {
              removeCollection(filter);
              setFilter(ALL);
            }}
          >
            {t("{name} koleksiyonunu kaldır", { name: t(filter) })}
          </Button>
        )}
      </div>

      <form
        className="library__collection-form library__import"
        onSubmit={(e) => {
          e.preventDefault();
          const draft = readShareCode(code);
          if (!draft || !data.champions.has(draft.championId)) {
            toast("error", t("Bu bir Vizier paylaşım kodu değil ya da bozuk."));
            return;
          }
          setSelected(createBuild(draft).id);
          setCode("");
          toast("success", t("{name} buildlerine eklendi", { name: draft.name }));
        }}
      >
        <input className="text-input" aria-label={t("Paylaşım kodu")} placeholder={t("Bir arkadaşının paylaşım kodunu yapıştır")} value={code} onChange={(e) => setCode(e.target.value)} />
        <Button size="small" type="submit" disabled={!code.trim()}>
          {t("Kodla ekle")}
        </Button>
      </form>

      {library.builds.length > 1 && (
        <div className="library__filters">
          <Select
            label={t("Sırala")}
            value={sort}
            options={[
              { value: "edited" as LibrarySort, label: t("Son düzenlenen") },
              { value: "champion" as LibrarySort, label: t("Şampiyon") },
              { value: "name" as LibrarySort, label: t("Ad") },
              { value: "collection" as LibrarySort, label: t("Koleksiyon") },
            ]}
            onChange={setSort}
          />
          {tags.length > 0 && (
            <Select label={t("Etiket")} value={tag} options={[{ value: "", label: t("Hepsi") }, ...tags.map((x) => ({ value: x.tag, label: `${x.tag} (${x.count})` }))]} onChange={setTag} />
          )}
        </div>
      )}

      <div className="library__new">
        <Select label={t("Yeni build için şampiyon")} value={newChampion || championOptions[0]?.value || ""} options={championOptions} onChange={setNewChampion} />
        <Button variant="primary" onClick={startNew}>
          {t("Yeni build")}
        </Button>
      </div>

      {library.builds.length === 0 ? (
        <EmptyState title={t("Henüz kayıtlı build yok")}>
          {t("Keşfet'teki bir build'i kaydet ya da yukarıdan bir şampiyon seçip yeni bir build başlat.")}
        </EmptyState>
      ) : (
        <div className="library__split">
          <ul className="library__saved" aria-label={t("Kayıtlı buildler")}>
            {shown.length === 0 && <li className="build__note">{t("Bu koleksiyonda build yok.")}</li>}
            {shown.map((b) => {
              const champion = data.champions.get(b.championId);
              return (
                <li key={b.id}>
                  <button type="button" className="library__saved-item" aria-pressed={current?.id === b.id} onClick={() => setSelected(b.id)}>
                    {champion && <img src={championIconUrl(data.version, champion.id)} alt="" width={32} height={32} />}
                    <span className="library__who">
                      <span className="library__name">{b.name}</span>
                      <span className="build__stat">{[champion?.name, b.favourite ? t("Favori") : null, ...(b.tags ?? []).map((x) => `#${x}`)].filter(Boolean).join(", ")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {current && <SavedBuildView key={current.id} build={current} data={data} others={library.builds} onEdit={() => setEditing(current)} onSelect={setSelected} />}
        </div>
      )}

      {editing && <BuildEditor build={editing} data={data} collections={library.collections} onSave={onSave} onClose={() => setEditing(null)} />}
    </div>
  );
}
