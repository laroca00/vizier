import { useMemo, useState } from "react";
import { getBuild, type Build } from "../api";
import { DataBadge } from "../ui/DataBadge";
import { formatPercent, useLang, useT } from "../i18n";
import { buildGold } from "../library/gold";
import { loadLibraryData, type LibraryData } from "../library/data";
import { useLibrary } from "../library/store";
import { labColumns, savedFor, type LabColumn } from "../lab/columns";
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
            <LabColumns data={data.value} championId={champion.key} position={route.position} />
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
  const saved = mine.find((b) => b.id === pickedId) ?? mine[0] ?? null;

  if (build.status === "error") return <ErrorState message={t(loadErrorMessage(build.error, online))} onRetry={retry} />;
  if (build.status !== "done") return <Skeleton lines={6} label={t("Yükleniyor")} />;

  const finished = (id: number) => !!data.items.get(id)?.complete;
  const columns = labColumns(build.value, saved, championId, { position, finished });
  if (columns.length === 0) return <EmptyState title={t("Bu rol için build yok")}>{t("Henüz yeterli maç ya da kayıtlı build yok. Başka bir rol dene.")}</EmptyState>;

  return (
    <>
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
          <LabCard key={column.id} column={column} data={data} patches={build.value?.patches} updatedAt={build.value?.updatedAt} />
        ))}
      </div>
    </>
  );
}

function LabCard({ column, data, patches, updatedAt }: { column: LabColumn; data: LibraryData; patches: Build["patches"] | undefined; updatedAt: number | undefined }) {
  const t = useT();
  const lang = useLang();
  const price = (id: number) => data.items.get(id)?.gold ?? 0;
  const gold = buildGold(column.build, price);
  const all = [...column.build.startItems, ...column.build.coreItems, ...column.build.items];
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
      <h2 className="draft__heading">{t(column.label)}</h2>
      {column.sample ? (
        <p className="build__stat">
          {t("{games} maçta, {rate} kazanma", { games: column.sample.games, rate: formatPercent(column.sample.winRate, lang, 1) })}
          {column.style && ` · ${column.style}`}{" "}
          <DataBadge {...column.sample} patches={patches} updatedAt={updatedAt} source={t("Vizier crawler, dereceli maçlar")} />
        </p>
      ) : (
        <p className="build__stat">{column.build.name}</p>
      )}
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
      <details className="lab__runes">
        <summary>{t("Rünler")}</summary>
        <RunePageView primary={primary} secondary={secondary} perks={column.build.runes.perks} total={column.sample?.games ?? 0} />
      </details>
    </section>
  );
}
