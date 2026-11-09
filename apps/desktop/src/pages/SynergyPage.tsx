import { useState } from "react";
import { getSynergies } from "../api";
import { championIconUrl } from "../data/ddragon";
import { groupByCategory, sortByData, synergyRows, type SynergyRow } from "../data/synergyList";
import { SYNERGY_TEXT } from "../data/synergyReasons";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { loadLibraryData } from "../library/data";
import { loadErrorMessage } from "../loadError";
import { DataBadge } from "../ui/DataBadge";
import { Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import { useOnline } from "../useOnline";
import { ChampionField } from "./MatchupPage";
import "./SynergyPage.css";

export type SynergyRoute = { page: "synergy"; championId: number | null; position: string };
type Props = { route: SynergyRoute; onChange: (next: SynergyRoute) => void; onOpenChampion: (championId: number, position: string | null) => void };
type Order = "data" | "category";
const ANY = "ANY";

/** Partners of a champion: crawler numbers where there are enough games, and the rule-based reason for every pair. */
export function SynergyPage({ route, onChange, onOpenChampion }: Props) {
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const [data, retry] = useAsync("synergy-static", loadLibraryData);
  const [partnerRole, setPartnerRole] = useState(ANY);
  const [order, setOrder] = useState<Order>("data");
  const list = data.status === "done" ? [...data.value.champions.values()].sort((a, b) => a.name.localeCompare(b.name, lang)) : [];
  const me = data.status === "done" && route.championId !== null ? data.value.champions.get(route.championId) : undefined;
  const [allies] = useAsync(me ? `synergy:${me.key}:${route.position}` : null, () => getSynergies(me!.key, route.position).catch(() => null));

  return (
    <LiquidGlass className="panel tiers matchup-page synergy" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Sinerji gezgini")} subtitle={t("Bir şampiyon seç; birlikte iyi çalıştığı şampiyonları, oyun sayısı ve nedeniyle gör.")} />
      {data.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(data.error, online))} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <>
          <div className="matchup-page__sides">
            <ChampionField label={t("Şampiyon")} value={me} list={list} version={data.value.version} onPick={(id) => onChange({ ...route, championId: id })} />
            <Select
              label={t("Rol")}
              value={route.position}
              options={Object.entries(POSITIONS).map(([value, label]) => ({ value, label: t(label) }))}
              onChange={(position) => onChange({ ...route, position })}
            />
            <Select label={t("Ortağın rolü")} value={partnerRole} options={[{ value: ANY, label: t("Hepsi") }, ...Object.entries(POSITIONS).map(([value, label]) => ({ value, label: t(label) }))]} onChange={setPartnerRole} />
            <Select
              label={t("Sıralama")}
              value={order}
              options={[
                { value: "data", label: t("Veriye göre") },
                { value: "category", label: t("Nedene göre") },
              ]}
              onChange={setOrder}
            />
          </div>
          {!me ? (
            <EmptyState title={t("Bir şampiyon seç")}>{t("Seçtiğin şampiyonun ortakları burada listelenir.")}</EmptyState>
          ) : (
            <Partners
              rows={synergyRows(me, data.value.champions, allies.status === "done" && allies.value ? allies.value.allies : [], partnerRole === ANY ? null : partnerRole)}
              order={order}
              version={data.value.version}
              loading={allies.status === "loading"}
              meta={allies.status === "done" ? allies.value : null}
              onOpenChampion={onOpenChampion}
            />
          )}
        </>
      )}
    </LiquidGlass>
  );
}

function Partners({
  rows,
  order,
  version,
  loading,
  meta,
  onOpenChampion,
}: {
  rows: SynergyRow[];
  order: Order;
  version: string;
  loading: boolean;
  meta: { games: number; winRate?: number; patches: string[]; updatedAt?: number } | null;
  onOpenChampion: (id: number, position: string | null) => void;
}) {
  const t = useT();
  const lang = useLang();
  if (loading) return <Skeleton lines={4} label={t("Yükleniyor")} />;
  if (rows.length === 0) return <EmptyState title={t("Ortak bulunamadı")}>{t("Bu seçimle listelenecek ortak yok.")}</EmptyState>;
  const row = (r: SynergyRow) => (
    <li key={r.champion.key} className="synergy__row" data-has-data={r.data ? "" : undefined}>
      <button type="button" className="synergy__champion" onClick={() => onOpenChampion(r.champion.key, r.data?.position ?? null)}>
        <img src={championIconUrl(version, r.champion.id)} alt="" width={32} height={32} loading="lazy" />
        {r.champion.name}
      </button>
      {r.data ? (
        <span className="synergy__numbers">
          {formatPercent(r.data.winRate, lang, 1)} · {t("{games} maç", { games: r.data.games })} · {t(POSITIONS[r.data.position] ?? r.data.position)}
        </span>
      ) : (
        <span className="build__stat">{t("Yeterli maç yok; yalnız neden")}</span>
      )}
      <span className="synergy__reasons">{r.reasons.map((c) => t(SYNERGY_TEXT[c].name)).join(", ")}</span>
    </li>
  );
  const sample = rows.filter((r) => r.data);
  const badgeRows = sample.reduce((sum, r) => sum + r.data!.games, 0);
  return (
    <>
      <p className="build__stat">
        {sample.length > 0 && meta && (
          <DataBadge
            games={badgeRows}
            winRate={sample.reduce((s, r) => s + r.data!.winRate * r.data!.games, 0) / badgeRows}
            patches={meta.patches}
            updatedAt={meta.updatedAt}
            source={t("Ortaklık verisi")}
          />
        )}{" "}
        <DataBadge editorial source={t("Nedenler Vizier'in kurallarından gelir; maç verisi değil.")} />
      </p>
      {order === "data" ? (
        <ul className="synergy__list">{sortByData(rows, lang).map(row)}</ul>
      ) : (
        groupByCategory(rows, lang).map((g) => (
          <section key={g.category}>
            <h3 className="draft__heading">{t(SYNERGY_TEXT[g.category].name)}</h3>
            <p className="build__note">{t(SYNERGY_TEXT[g.category].reason)}</p>
            <ul className="synergy__list">{g.rows.map(row)}</ul>
          </section>
        ))
      )}
      <p className="build__note">{t("Oyun sayısı yetersiz çiftlerde yalnız neden gösterilir; bu bir kazanma garantisi değil.")}</p>
    </>
  );
}
