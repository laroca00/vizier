import { useEffect, useId } from "react";
import { BuildSuggestion } from "../BuildSuggestion";
import { championIconUrl, champions, latestVersion, type Champion } from "../data/ddragon";
import { AcademyBlock } from "../draft/AcademyBlock";
import { ItemAdvicePanel } from "../draft/ItemAdvicePanel";
import { PhaseRead } from "../draft/PhaseRead";
import { StrengthsPanel } from "../draft/StrengthsPanel";
import { AbilityCompare } from "../draft/AbilityCompare";
import { LaneStats } from "../draft/LaneStatsPanel";
import { MatchupLength } from "../draft/MatchupLength";
import { PowerSpikes } from "../draft/PowerSpikes";
import { StatsDuel } from "../draft/StatsDuel";
import { MatchupGuide } from "../draft/MatchupGuide";
import { useLang, useT } from "../i18n";
import { AcademyNotes } from "../AcademyNotesPanel";
import { JournalNote, useMatchupTemplate } from "../Journal";
import { POSITIONS } from "../labels";
import { matchupNoteKey, noteMatchupOpened } from "../personal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Fields";
import { RankPicker } from "../ui/RankPicker";
import { LiquidGlass } from "../ui/LiquidGlass";
import { FavouriteButton } from "../workspace/FavouriteButton";
import { PageHeader } from "../ui/Page";
import { loadErrorMessage } from "../loadError";
import { useOnline } from "../useOnline";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import "../library/library.css";
import "./MatchupPage.css";
import { findChampion, isComplete, swapSides, type MatchupRoute } from "./matchupRoute";

async function loadStatic() {
  const [version, byKey] = await Promise.all([latestVersion(), champions()]);
  return { version, champions: byKey };
}

export function ChampionField({ label, value, list, version, onPick }: { label: string; value: Champion | undefined; list: Champion[]; version: string; onPick: (id: number) => void }) {
  const listId = useId();
  return (
    <span className="matchup-page__side">
      {value && <img src={championIconUrl(version, value.id)} alt="" width={44} height={44} />}
      <span className="field">
        <label htmlFor={listId + "-input"} className="field__label">
          {label}
        </label>
        {/* Keyed by the champion so a swap shows the new name. */}
        <input
          key={value?.key ?? "none"}
          id={listId + "-input"}
          list={listId}
          defaultValue={value?.name ?? ""}
          onChange={(event) => {
            const hit = findChampion(list, event.target.value);
            if (hit) onPick(hit.key);
          }}
        />
        <datalist id={listId}>
          {list.map((c) => (
            <option key={c.key} value={c.name} />
          ))}
        </datalist>
      </span>
    </span>
  );
}

/** Study how two champions meet in a role, before the game and outside champ select. */
export function MatchupPage({ route, onChange }: { route: MatchupRoute; onChange: (next: MatchupRoute) => void }) {
  const t = useT();
  const template = useMatchupTemplate();
  const lang = useLang();
  const [data, retry] = useAsync("static", loadStatic);
  const online = useOnline();
  const list = data.status === "done" ? [...data.value.champions.values()].sort((a, b) => a.name.localeCompare(b.name, lang)) : [];
  const byKey = data.status === "done" ? data.value.champions : new Map<number, Champion>();
  const me = route.championId === null ? undefined : byKey.get(route.championId);
  const opponent = route.opponentId === null ? undefined : byKey.get(route.opponentId);
  const opened = me && opponent ? { championId: me.key, opponentId: opponent.key, position: route.position } : null;
  useEffect(() => {
    if (opened) noteMatchupOpened(opened);
  }, [opened?.championId, opened?.opponentId, opened?.position]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <LiquidGlass className="panel tiers matchup-page" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Eşleşme çalışması")} subtitle={t("İki şampiyonun bir rolde karşılaşmasını oyundan önce incele.")} toolbar={<RankPicker />} />
      {data.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(data.error, online))} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <>
          <div className="matchup-page__sides">
            <ChampionField label={t("Senin şampiyonun")} value={me} list={list} version={data.value.version} onPick={(id) => onChange({ ...route, championId: id })} />
            <Button size="small" onClick={() => onChange(swapSides(route))}>
              {t("Yer değiştir")}
            </Button>
            <ChampionField label={t("Rakip")} value={opponent} list={list} version={data.value.version} onPick={(id) => onChange({ ...route, opponentId: id })} />
            <Select
              label={t("Rol")}
              value={route.position}
              options={Object.entries(POSITIONS).map(([value, label]) => ({ value, label: t(label) }))}
              onChange={(position) => onChange({ ...route, position })}
            />
          </div>
          {isComplete(route) && me && opponent ? (
            <div className="matchup-page__body">
              <FavouriteButton kind="matchup" id={`${route.championId}:${route.opponentId}`} label={`${me.name} – ${opponent.name}`} championId={route.championId} />
              <AcademyBlock sources={["crawler", "ddragon"]}>
                <MatchupGuide championId={route.championId} position={route.position} opponent={opponent} version={data.value.version} />
              </AcademyBlock>
              <AcademyBlock sources={["editorial"]}>
                <section aria-label={t("Güçlü ve zayıf yönler")}>
                  <div className="academy__pair">
                    <StrengthsPanel championId={me.id} name={me.name} />
                    <StrengthsPanel championId={opponent.id} name={opponent.name} />
                  </div>
                </section>
              </AcademyBlock>
              <AcademyBlock sources={["ddragon"]}>
                <AbilityCompare champion={me} opponent={opponent} version={data.value.version} />
              </AcademyBlock>
              <AcademyBlock sources={["editorial"]}>
                <PhaseRead champion={me} opponent={opponent} position={route.position} />
              </AcademyBlock>
              <AcademyBlock sources={["crawler", "ddragon"]}>
                <PowerSpikes champion={me} opponent={opponent} position={route.position} version={data.value.version} />
              </AcademyBlock>
              <AcademyBlock sources={["editorial", "crawler"]}>
                <ItemAdvicePanel championId={route.championId} position={route.position} enemies={[opponent]} />
              </AcademyBlock>
              <AcademyBlock sources={["crawler"]}>
                <LaneStats championId={route.championId} position={route.position} opponentId={route.opponentId} />
              </AcademyBlock>
              <AcademyBlock sources={["crawler"]}>
                <MatchupLength championId={route.championId} opponentId={route.opponentId} position={route.position} />
              </AcademyBlock>
              <AcademyBlock sources={["ddragon"]}>
                <StatsDuel champion={me} opponent={opponent} />
              </AcademyBlock>
              <section aria-label={t("Build")}>
                <h2 className="draft__heading">{t("{champion} için {opponent} karşısında build", { champion: me.name, opponent: opponent.name })}</h2>
                <BuildSuggestion
                  championId={route.championId}
                  championName={me.name}
                  position={route.position}
                  currentSpells={[0, 0]}
                  locked={false}
                  vs={route.opponentId}
                  inDraft={false}
                  showPros
                />
              </section>
              <JournalNote noteKey={matchupNoteKey(route.championId, route.opponentId)} label={t("Eşleşme notun")} template={template} />
              <AcademyNotes noteKey={matchupNoteKey(route.championId, route.opponentId)} />
            </div>
          ) : (
            <EmptyState title={t("İki şampiyon seç")}>{t("Eşleşmeyi görmek için iki farklı şampiyon ve bir rol seç.")}</EmptyState>
          )}
        </>
      )}
    </LiquidGlass>
  );
}
