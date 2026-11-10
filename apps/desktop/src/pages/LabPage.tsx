import { useMemo, useState } from "react";
import { getBuild, getProBuilds, type Build } from "../api";
import { DataBadge } from "../ui/DataBadge";
import { formatPercent, useLang, useT } from "../i18n";
import { buildGold } from "../library/gold";
import { loadLibraryData, type LibraryData } from "../library/data";
import { BuildEditor } from "../library/BuildEditor";
import { createBuild, useLibrary, type SavedBuild } from "../library/store";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { pathColumn, type PathKind } from "../lab/itemPath";
import { DIRECTIONS, directionColumn, type DirectionId } from "../lab/directions";
import { STAT_PRICES } from "../data/itemGold";
import { runningTotals, shownStats, statValue } from "../lab/totals";
import { purposeOf } from "../lab/purpose";
import { LabTotals } from "../lab/LabTotals";
import { customColumn, customFrom, labColumns, proColumn, savedFor, type LabColumn } from "../lab/columns";
import { itemIconUrl, spellIconUrl } from "../data/ddragon";
import { POSITIONS } from "../labels";
import { loadErrorMessage } from "../loadError";
import { RunePageView } from "../RunePageView";
import { Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import { useOnline } from "../useOnline";
import { ChampionField } from "./MatchupPage";
import "../library/library.css";
import "./MatchupPage.css";
import "./LabPage.css";

type PathChoice = PathKind | "none";

export type LabRoute = { page: "lab"; championId: number | null; position: string };

type Props = { route: LabRoute; onChange: (next: LabRoute) => void };

/** Builds of one champion side by side: items in order with their cost, runes, spells and the games behind them. */
export function LabPage({ route, onChange }: Props) {
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const [data, retry] = useAsync("lab-static", loadLibraryData);
  const list = data.status === "done" ? [...data.value.champions.values()].sort((a, b) => a.name.localeCompare(b.name, lang)) : [];
  const champion = data.status === "done" && route.championId !== null ? data.value.champions.get(route.championId) : undefined;

  return (
    <LiquidGlass className="panel tiers matchup-page lab" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Eşya laboratuvarı")} subtitle={t("Bir şampiyonun build'lerini yan yana koy: eşyalar, maliyet, rünler ve arkasındaki maç sayısı.")} />
      {data.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(data.error, online))} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <>
          <div className="matchup-page__sides">
            <ChampionField label={t("Şampiyon")} value={champion} list={list} version={data.value.version} onPick={(id) => onChange({ ...route, championId: id })} />
            <Select
              label={t("Rol")}
              value={route.position}
              options={Object.entries(POSITIONS).map(([value, label]) => ({ value, label: t(label) }))}
              onChange={(position) => onChange({ ...route, position })}
            />
          </div>
          {champion ? (
            <LabColumns key={`${champion.key}:${route.position}`} data={data.value} championId={champion.key} position={route.position} />
          ) : (
            <EmptyState title={t("Bir şampiyon seç")}>{t("Seçtiğin şampiyonun en çok oynanan, en çok kazanan ve kayıtlı build'i burada yan yana görünür.")}</EmptyState>
          )}
        </>
      )}
    </LiquidGlass>
  );
}

function LabColumns({ data, championId, position }: { data: LibraryData; championId: number; position: string }) {
  const t = useT();
  const online = useOnline();
  const library = useLibrary();
  const [build, retry] = useAsync(`lab-build:${championId}:${position}`, () => getBuild(championId, position));
  const mine = useMemo(() => savedFor(library.builds, championId, position), [library.builds, championId, position]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [direction, setDirection] = useState<DirectionId>("standard");
  const [custom, setCustom] = useState<SavedBuild | null>(null);
  const [editing, setEditing] = useState(false);
  const [proKey, setProKey] = useState("");
  const [pathKind, setPathKind] = useState<PathKind | null>(null);
  const [pros] = useAsync(`lab-pros:${championId}:${position}`, () => getProBuilds({ championId, position, limit: 10 }).catch(() => []));
  const toast = useToast();
  const saved = mine.find((b) => b.id === pickedId) ?? mine[0] ?? null;

  if (build.status === "error") return <ErrorState message={t(loadErrorMessage(build.error, online))} onRetry={retry} />;
  if (build.status !== "done") return <Skeleton lines={6} label={t("Yükleniyor")} />;

  const finished = (id: number) => !!data.items.get(id)?.complete;
  const columns = labColumns(build.value, saved, championId, { position, finished });
  const proList = pros.status === "done" ? pros.value : [];
  const pro = proList.find((p) => p.matchId === proKey);
  if (pro) columns.push(proColumn(pro, championId, { position, finished }));
  if (custom) columns.push(customColumn(custom));
  const route = build.value && pathKind ? pathColumn(build.value, pathKind, championId, { position, finished }) : null;
  if (route) columns.push(route);
  const extra = build.value ? directionColumn(direction, build.value, data.details, championId, position) : null;
  if (extra) columns.push(extra);
  if (columns.length === 0) return <EmptyState title={t("Bu rol için build yok")}>{t("Henüz yeterli maç ya da kayıtlı build yok. Başka bir rol dene.")}</EmptyState>;

  return (
    <>
      <div className="lab__controls">
        <Select
          label={t("Yön")}
          value={direction}
          options={DIRECTIONS.map((d) => ({ value: d.id, label: t(d.label) }))}
          onChange={setDirection}
        />
        <p className="build__stat">{t(DIRECTIONS.find((d) => d.id === direction)?.blurb ?? "")}</p>
        {direction !== "standard" && !extra && <p className="build__note">{t("Bu yöne uyan yeterli eşya bu şampiyonun build'lerinde yok.")}</p>}
      </div>
      <div className="lab__controls">
        {(build.value?.itemTree?.length ?? 0) > 0 && (
          <Select<PathChoice>
            label={t("Eşya yolu")}
            value={pathKind ?? "none"}
            options={[
              { value: "none", label: t("Yok") },
              { value: "winning", label: t("En çok kazanan yol") },
              { value: "popular", label: t("En popüler yol") },
            ]}
            onChange={(next) => setPathKind(next === "none" ? null : next)}
          />
        )}
        {proList.length > 0 && (
          <Select
            label={t("Pro build ekle")}
            value={proKey}
            options={[{ value: "", label: t("Yok") }, ...proList.map((p) => ({ value: p.matchId, label: `${p.player} (${p.patch})` }))]}
            onChange={setProKey}
          />
        )}
        {!custom && columns.length > 0 && (
          <Button
            size="small"
            onClick={() => {
              setCustom(customFrom(columns[0], t("Lab build'i")));
              setEditing(true);
            }}
          >
            {t("Özel sütun ekle")}
          </Button>
        )}
      </div>
      {mine.length > 1 && (
        <Select
          label={t("Kayıtlı build")}
          value={saved?.id ?? ""}
          options={mine.map((b) => ({ value: b.id, label: b.name }))}
          onChange={setPickedId}
        />
      )}
      <div className="lab__columns" style={{ "--columns": columns.length } as React.CSSProperties}>
        {columns.map((column) => (
          <LabCard
            key={column.id}
            column={column}
            data={data}
            patches={build.value?.patches}
            updatedAt={build.value?.updatedAt}
            actions={
              column.id === "custom" && custom ? (
                <div className="lab__actions">
                  <Button size="small" onClick={() => setEditing(true)}>
                    {t("Düzenle")}
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      const { id: _id, createdAt: _c, updatedAt: _u, ...draft } = custom;
                      createBuild(draft);
                      toast("success", t("Kütüphaneye kaydedildi."));
                    }}
                  >
                    {t("Kütüphaneye kaydet")}
                  </Button>
                  <Button size="small" onClick={() => setCustom(null)}>
                    {t("Kaldır")}
                  </Button>
                </div>
              ) : undefined
            }
          />
        ))}
      </div>
      <LabTotals columns={columns} data={data} />
      {editing && custom && (
        <BuildEditor
          build={custom}
          data={data}
          collections={library.collections}
          onSave={(next) => {
            setCustom(next);
            setEditing(false);
          }}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

function LabCard({ column, data, patches, updatedAt, actions }: { column: LabColumn; data: LibraryData; patches: Build["patches"] | undefined; updatedAt: number | undefined; actions?: React.ReactNode }) {
  const t = useT();
  const lang = useLang();
  const price = (id: number) => data.items.get(id)?.gold ?? 0;
  const gold = buildGold(column.build, price);
  const all = [...column.build.startItems, ...column.build.coreItems, ...column.build.items];
  const fullItems = [...column.build.coreItems, ...column.build.items];
  const purpose = purposeOf(fullItems, data.details);
  const boots = all.find((id) => data.items.get(id)?.boots);
  const primary = data.styles.get(column.build.runes.primaryStyle);
  const secondary = data.styles.get(column.build.runes.subStyle);
  const icon = (id: number) => (
    <li key={`${id}`} title={`${data.items.get(id)?.name ?? id} · ${t("{gold} altın", { gold: price(id) })}`}>
      <img src={itemIconUrl(data.version, id)} alt={data.items.get(id)?.name ?? ""} width={36} height={36} loading="lazy" />
      <span>{price(id)}</span>
    </li>
  );

  return (
    <section className="lab__card" aria-label={t(column.label)}>
      <h2 className="draft__heading">{column.id === "direction" && column.style ? `${t(column.label)}: ${t(column.style)}` : t(column.label)}</h2>
      {column.sample ? (
        <p className="build__stat">
          {t("{games} maçta, {rate} kazanma", { games: column.sample.games, rate: formatPercent(column.sample.winRate, lang, 1) })}
          {column.style && ` · ${column.style}`}{" "}
          <DataBadge {...column.sample} patches={patches} updatedAt={updatedAt} ranked source={t("Vizier crawler, dereceli maçlar")} />
        </p>
      ) : column.basis === "data" ? (
        <p className="build__stat">{t("Tank takımlara karşı alınan eşyalar, {games} maç", { games: column.games ?? 0 })}</p>
      ) : column.basis === "editorial" ? (
        <p className="build__stat">
          {t("Şampiyonun build'lerindeki eşyalar bu yöne göre süzüldü.")} <DataBadge editorial source={t("Eşya etiketlerinden elle yazılmış bir kural; istatistik değil.")} />
        </p>
      ) : (
        <p className="build__stat">{column.note ?? column.build.name}</p>
      )}
      {actions}
      {column.build.startItems.length > 0 && (
        <>
          <p className="lab__label">{t("Başlangıç")}</p>
          <ul className="lab__items">{column.build.startItems.map(icon)}</ul>
        </>
      )}
      <p className="lab__label">{t("Çekirdek")}</p>
      <ul className="lab__items">{column.build.coreItems.length > 0 ? column.build.coreItems.map(icon) : <li>–</li>}</ul>
      {column.build.items.length > 0 && (
        <>
          <p className="lab__label">{t("Sonra")}</p>
          <ul className="lab__items">{column.build.items.map(icon)}</ul>
        </>
      )}
      {purpose && (
        <p className="lab__purpose">
          <strong>{t("Bu build ne için")}:</strong> {[t(purpose.damage), ...purpose.extras.map((e) => t(e))].join(", ")}; {t(purpose.survival)}.{" "}
          <DataBadge editorial source={t("Eşya değerlerinden elle yazılmış kurallarla okunur; istatistik değil.")} />
        </p>
      )}
      <dl className="lab__figures">
        <div>
          <dt>{t("Toplam")}</dt>
          <dd>{t("{gold} altın", { gold: gold.total })}</dd>
        </div>
        {gold.spike && (
          <div>
            <dt>{t("İlk {n} eşya", { n: gold.spike.items })}</dt>
            <dd>{t("{gold} altın", { gold: gold.spike.gold })}</dd>
          </div>
        )}
        {boots && (
          <div>
            <dt>{t("Bot")}</dt>
            <dd>{data.items.get(boots)?.name}</dd>
          </div>
        )}
      </dl>
      <div className="lab__spells">
        {column.build.spells.map((id) => {
          const spell = data.spells.get(id);
          return spell ? <img key={id} src={spellIconUrl(data.version, spell.id)} alt={spell.name} title={spell.name} width={28} height={28} loading="lazy" /> : null;
        })}
      </div>
      <details className="lab__steps">
        <summary>{t("Eşya eşya toplam")}</summary>
        <ol>
          {runningTotals(fullItems, data.details).map((total, i) => (
            <li key={i}>
              <strong>{data.items.get(fullItems[i])?.name}</strong>
              {shownStats([total]).map((key) => (
                <span key={key}>
                  {t(STAT_PRICES[key].label)} {statValue(key, total[key] ?? 0)}
                  {STAT_PRICES[key].percent ? "%" : ""}
                </span>
              ))}
            </li>
          ))}
        </ol>
      </details>
      <details className="lab__runes">
        <summary>{t("Rünler")}</summary>
        <RunePageView primary={primary} secondary={secondary} perks={column.build.runes.perks} total={column.sample?.games ?? 0} />
      </details>
    </section>
  );
}
