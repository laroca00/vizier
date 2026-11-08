import { useState } from "react";
import { getTierList, type TierEntry } from "../api";
import { championIconUrl, champions, latestVersion, roleIconUrl, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS, positionLabel } from "../labels";
import { useLibrary } from "../library/store";
import "../library/library.css";
import "./champions.css";
import {
  addToPool,
  removeFromPool,
  toggleFavouriteChampion,
  updatePoolPick,
  usePersonal,
  type PoolPick,
  type PoolRank,
} from "../personal";
import { Button } from "../ui/Button";
import { FilterChips, SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { Tabs } from "../ui/Tabs";
import { PoolCoverage } from "./PoolCoverage";
import { useAsync } from "../useAsync";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const ALL = "ALL";
// Below this share of a role's games a champion is an off-role pick, not one of the role's champions.
const MIN_ROLE_PICK_RATE = 0.005;

type Difficulty = "easy" | "medium" | "hard";
const DIFFICULTIES: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Kolay" },
  { id: "medium", label: "Orta" },
  { id: "hard", label: "Zor" },
];

/** Data Dragon rates difficulty from 1 to 10. */
export function difficultyOf(champion: Pick<Champion, "info">): Difficulty {
  const d = champion.info.difficulty;
  return d <= 3 ? "easy" : d <= 7 ? "medium" : "hard";
}

export type ChampionRoles = { version: string; champions: Map<number, Champion>; roles: Map<number, Map<string, TierEntry>> };
type Data = ChampionRoles;

/** Every champion with the roles it is played in, from the five ranked tier lists. */
export async function loadChampionRoles(): Promise<Data> {
  const [version, championList, ...lists] = await Promise.all([
    latestVersion(),
    champions(),
    ...ROLES.map((role) => getTierList(role).catch(() => null)),
  ]);
  const roles = new Map<number, Map<string, TierEntry>>();
  lists.forEach((list, i) => {
    for (const entry of list?.champions ?? []) {
      if (entry.pickRate < MIN_ROLE_PICK_RATE) continue;
      if (!roles.has(entry.championId)) roles.set(entry.championId, new Map());
      roles.get(entry.championId)!.set(ROLES[i], entry);
    }
  });
  return { version, champions: championList, roles };
}

type View = "all" | "pool";
type Props = { onOpenChampion: (championId: number, position: string | null) => void };

export function ChampionsPage({ onOpenChampion }: Props) {
  const t = useT();
  const [view, setView] = useState<View>("all");
  const [data, retry] = useAsync("champion-roles", loadChampionRoles);
  return (
    <LiquidGlass className="panel tiers champions" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Şampiyonlar")}
        subtitle={view === "all" ? t("Her şampiyon, rolleri ve zorluğuyla") : t("Ana ve yedek seçimlerin, rol rol")}
        toolbar={
          <Tabs
            label={t("Görünüm")}
            items={[
              { id: "all" as View, label: t("Tüm şampiyonlar") },
              { id: "pool" as View, label: t("Havuzum") },
            ]}
            value={view}
            onChange={setView}
          />
        }
      />
      {data.status === "error" ? (
        <ErrorState message={t("Oyun verisi alınamadı.")} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : view === "all" ? (
        <AllChampions data={data.value} onOpenChampion={onOpenChampion} />
      ) : (
        <PoolManager data={data.value} onOpenChampion={onOpenChampion} />
      )}
    </LiquidGlass>
  );
}

type Sort = "name" | "difficulty" | "winRate";

function AllChampions({ data, onOpenChampion }: { data: Data; onOpenChampion: Props["onOpenChampion"] }) {
  const t = useT();
  const lang = useLang();
  const personal = usePersonal();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(ALL);
  const [difficulty, setDifficulty] = useState<Difficulty[]>([]);
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [sort, setSort] = useState<Sort>("name");

  const needle = query.trim().toLocaleLowerCase(lang);
  const rateOf = (c: Champion) => {
    const roles = data.roles.get(c.key);
    if (!roles) return null;
    if (role !== ALL) return roles.get(role)?.winRate ?? null;
    return Math.max(...[...roles.values()].map((e) => e.winRate));
  };
  const list = [...data.champions.values()]
    .filter(
      (c) =>
        (!needle || c.name.toLocaleLowerCase(lang).includes(needle)) &&
        (role === ALL || data.roles.get(c.key)?.has(role)) &&
        (difficulty.length === 0 || difficulty.includes(difficultyOf(c))) &&
        (!onlyFavourites || personal.favourites.includes(c.key)),
    )
    .sort((a, b) =>
      sort === "difficulty"
        ? a.info.difficulty - b.info.difficulty || a.name.localeCompare(b.name, lang)
        : sort === "winRate"
          ? (rateOf(b) ?? 0) - (rateOf(a) ?? 0)
          : a.name.localeCompare(b.name, lang),
    );

  return (
    <>
      <div className="library__filters">
        <SearchInput label={t("Şampiyon ara")} value={query} onChange={setQuery} placeholder={t("Şampiyon ara")} />
        <FilterChips label={t("Zorluk")} chips={DIFFICULTIES.map((d) => ({ id: d.id, label: t(d.label) }))} selected={difficulty} onChange={setDifficulty} />
        <FilterChips
          label={t("Favoriler")}
          chips={[{ id: "fav", label: t("Sadece favoriler") }]}
          selected={onlyFavourites ? ["fav"] : []}
          onChange={(s) => setOnlyFavourites(s.length > 0)}
        />
        <Select
          label={t("Sırala")}
          value={sort}
          options={[
            { value: "name" as Sort, label: t("Ada göre") },
            { value: "difficulty" as Sort, label: t("Zorluğa göre") },
            { value: "winRate" as Sort, label: t("Kazanma oranına göre") },
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
      <p className="build__note">{t("{count} şampiyon", { count: list.length })}</p>
      {list.length === 0 ? (
        <EmptyState title={t("Bu filtrelere uyan şampiyon yok")}>{t("Bir filtreyi kaldırıp tekrar dene.")}</EmptyState>
      ) : (
        <ul className="champions__grid">
          {list.map((c) => {
            const rate = rateOf(c);
            const favourite = personal.favourites.includes(c.key);
            const bestRole = role !== ALL ? role : ([...(data.roles.get(c.key)?.entries() ?? [])].sort((a, b) => b[1].games - a[1].games)[0]?.[0] ?? null);
            return (
              <li key={c.key} className="champions__card">
                <button type="button" className="champions__open" onClick={() => onOpenChampion(c.key, bestRole)}>
                  <img src={championIconUrl(data.version, c.id)} alt="" width={56} height={56} loading="lazy" />
                  <span className="champions__name">{c.name}</span>
                  <span className="champions__meta">
                    {t(DIFFICULTIES.find((d) => d.id === difficultyOf(c))!.label)}
                    {rate !== null && `, ${formatPercent(rate, lang, 1)}`}
                  </span>
                </button>
                <button
                  type="button"
                  className="champions__fav"
                  aria-pressed={favourite}
                  aria-label={favourite ? t("{champion} favorilerden çıkar", { champion: c.name }) : t("{champion} favorilere ekle", { champion: c.name })}
                  onClick={() => toggleFavouriteChampion(c.key)}
                >
                  <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden="true">
                    <path d="M10 3.2l2 4.1 4.5.6-3.3 3.1.8 4.5L10 13.4l-4 2.1.8-4.5-3.3-3.1 4.5-.6z" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const ANY = "ANY";

function PoolManager({ data, onOpenChampion }: { data: Data; onOpenChampion: Props["onOpenChampion"] }) {
  const t = useT();
  const lang = useLang();
  const personal = usePersonal();
  const library = useLibrary();
  const sorted = [...data.champions.values()].sort((a, b) => a.name.localeCompare(b.name, lang));
  const [championId, setChampionId] = useState(String(sorted[0]?.key ?? ""));
  const [role, setRole] = useState<string>("MIDDLE");
  const [rank, setRank] = useState<PoolRank>("main");

  const groups = [...ROLES, ANY].map((r) => ({
    role: r,
    picks: personal.pool.filter((p) => (r === ANY ? p.position === null : p.position === r)).sort((a, b) => (a.rank === b.rank ? 0 : a.rank === "main" ? -1 : 1)),
  }));

  return (
    <>
      <form
        className="library__filters"
        onSubmit={(e) => {
          e.preventDefault();
          addToPool(Number(championId), role === ANY ? null : role, rank);
        }}
      >
        <Select label={t("Şampiyon")} value={championId} options={sorted.map((c) => ({ value: String(c.key), label: c.name }))} onChange={setChampionId} />
        <Select
          label={t("Rol")}
          value={role}
          options={[...ROLES.map((r) => ({ value: r, label: t(POSITIONS[r]) })), { value: ANY, label: t("Her rol") }]}
          onChange={setRole}
        />
        <Select
          label={t("Yer")}
          value={rank}
          options={[
            { value: "main" as PoolRank, label: t("Ana seçim") },
            { value: "secondary" as PoolRank, label: t("Yedek") },
          ]}
          onChange={setRank}
        />
        <Button variant="primary" type="submit">
          {t("Havuza ekle")}
        </Button>
      </form>

      {personal.pool.length === 0 ? (
        <EmptyState title={t("Havuzun boş")}>{t("Yukarıdan bir şampiyon ve rol seç. Havuzun şampiyon seçiminde ve ana sayfada görünür.")}</EmptyState>
      ) : (
        <div className="pool">
          {groups
            .filter((g) => g.picks.length > 0)
            .map((g) => (
              <section key={g.role} className="pool__role" aria-label={g.role === ANY ? t("Her rol") : (positionLabel(g.role, lang) ?? g.role)}>
                <h2 className="draft__heading">{g.role === ANY ? t("Her rol") : positionLabel(g.role, lang)}</h2>
                <ul className="pool__list">
                  {g.picks.map((pick) => (
                    <PoolRow key={`${pick.championId}:${pick.position}`} pick={pick} data={data} builds={library.builds} onOpen={() => onOpenChampion(pick.championId, pick.position)} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
      <PoolCoverage data={data} />
    </>
  );
}

function PoolRow({ pick, data, builds, onOpen }: { pick: PoolPick; data: Data; builds: { id: string; name: string; championId: number }[]; onOpen: () => void }) {
  const t = useT();
  const champion = data.champions.get(pick.championId);
  const own = builds.filter((b) => b.championId === pick.championId);
  const [note, setNote] = useState(pick.note);
  return (
    <li className="pool__row" data-rank={pick.rank}>
      <button type="button" className="library__open" onClick={onOpen}>
        {champion && <img src={championIconUrl(data.version, champion.id)} alt="" width={36} height={36} />}
        <span className="library__name">{champion?.name}</span>
      </button>
      <Tabs
        label={t("Yer")}
        size="small"
        items={[
          { id: "main" as PoolRank, label: t("Ana") },
          { id: "secondary" as PoolRank, label: t("Yedek") },
        ]}
        value={pick.rank}
        onChange={(rank) => updatePoolPick(pick, { rank })}
      />
      <input
        className="text-input pool__note"
        aria-label={t("{champion} notu", { champion: champion?.name ?? "" })}
        placeholder={t("Kısa not")}
        value={note}
        maxLength={120}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== pick.note && updatePoolPick(pick, { note })}
      />
      <Select
        label={t("Build")}
        hideLabel
        value={pick.buildId ?? ""}
        options={[{ value: "", label: own.length ? t("Build seçilmedi") : t("Kayıtlı build yok") }, ...own.map((b) => ({ value: b.id, label: b.name }))]}
        onChange={(id) => updatePoolPick(pick, { buildId: id || null })}
      />
      <Button size="small" variant="ghost" onClick={() => removeFromPool(pick)}>
        {t("Çıkar")}
      </Button>
    </li>
  );
}
