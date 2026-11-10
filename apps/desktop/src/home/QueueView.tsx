import { loadRoleLists, ROLE_LISTS_KEY } from "./ThisPatchCard";
import type { Flow, Lobby } from "../clientFlow";
import { lobbyRoles, wantsFill } from "../clientFlow";
import type { TierEntry } from "../api";
import { DataBadge } from "../ui/DataBadge";
import { ChampionIcon } from "../ui/GameIcons";
import { formatPercent, useLang, useT } from "../i18n";
import { positionLabel } from "../labels";
import { useLibrary } from "../library/store";
import { usePoolChanges } from "../patches/usePoolChanges";
import { usePersonal } from "../personal";
import { autofillPicks, queuePool } from "../queueView";
import { useAsync } from "../useAsync";
import { useOwnRankScope } from "../rank";
import { RankChip } from "../ui/RankPicker";
import "./queue.css";

type Props = { flow: Flow; lobby: Lobby | null; onOpenChampion: (championId: number, position: string | null) => void };

const STATE_TEXT: Partial<Record<Flow, string>> = { lobby: "Lobidesin", queue: "Maç aranıyor", readyCheck: "Maç bulundu" };

/** Pool picks for the roles asked for in the lobby, and what to play if the queue fills another role. */
export function QueueView({ flow, lobby, onOpenChampion }: Props) {
  const t = useT();
  const lang = useLang();
  // Picks for the queue are read at the player's own rank, like champ select.
  useOwnRankScope();
  const personal = usePersonal();
  const library = useLibrary();
  const patched = usePoolChanges();
  const [state] = useAsync(ROLE_LISTS_KEY, loadRoleLists);
  const roles = lobbyRoles(lobby);
  const fill = wantsFill(lobby);
  if (state.status !== "done") return null;
  const { entries, patches, byKey, version } = state.value;
  const mine = queuePool(personal.pool, roles, entries);
  const inPool = new Set(personal.pool.map((p) => p.championId));
  // In the lobby the roles can still change, so the other-role picks wait for the queue.
  const autofill = flow !== "lobby" && roles.length > 0 && !fill ? autofillPicks(roles, entries, (id) => byKey.get(id)?.info.difficulty ?? null, inPool, patches) : [];

  const row = (championId: number, position: string, entry: TierEntry | null, extra?: { buildName?: string | null; main?: boolean; showRole?: boolean }) => {
    const champion = byKey.get(championId);
    if (!champion) return null;
    const change = entry?.winRateChange;
    return (
      <li key={`${championId}:${position}`}>
        <button type="button" className="queue__row" onClick={() => onOpenChampion(championId, position)}>
          <ChampionIcon version={version} championId={champion.id} name="" size={36} />
          <span className="queue__text">
            <span className="queue__name">
              {champion.name} {extra?.main && <span className="queue__tag">{t("Ana")}</span>}
              {patched.has(String(championId)) && <span className="queue__tag">{t("Bu yamada değişti")}</span>}
            </span>
            <span className="queue__detail">
              {entry
                ? [
                    extra?.showRole ? (positionLabel(position, lang) ?? position) : null,
                    t("{tier} tier", { tier: entry.tier }),
                    formatPercent(entry.winRate, lang, 1),
                    t("{games} maç", { games: entry.games }),
                    change != null && Math.abs(change) >= 0.005 ? t("geçen yamaya göre {change}", { change: `${change > 0 ? "+" : "−"}${Math.abs(change * 100).toFixed(1)}` }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : t("Henüz yeterli maç yok")}
            </span>
            {extra?.buildName && <span className="queue__detail">{t("Kayıtlı build: {name}", { name: extra.buildName })}</span>}
          </span>
          {entry && <DataBadge games={entry.games} winRate={entry.winRate} patches={patches[position]} ranked source={t("Vizier crawler, dereceli maçlar")} />}
        </button>
      </li>
    );
  };

  return (
    <section className="queue enter" aria-label={t("Kuyruk")}>
      <h2 className="section-title">
        {t(STATE_TEXT[flow] ?? "Kuyruk")} <RankChip />
      </h2>
      {roles.length > 0 && (
        <p className="state__text">{t("Seçtiğin roller: {roles}", { roles: roles.map((r) => positionLabel(r, lang) ?? r).join(", ") })}</p>
      )}
      {fill && <p className="state__text">{t("Fill seçtin; her rol çıkabilir. Havuzun rollere göre:")}</p>}
      {mine.length === 0 ? (
        <p className="state__text">{t("Bu roller için havuzunda şampiyon yok. Bir şampiyonun sayfasında \"Havuzuna ekle\"ye bas.")}</p>
      ) : (
        <ul className="queue__list">
          {mine.map((pick) => row(pick.championId, pick.position, pick.entry, { main: pick.rank === "main", buildName: library.builds.find((b) => b.id === pick.buildId)?.name ?? null }))}
        </ul>
      )}
      {autofill.length > 0 && (
        <>
          <h3 className="queue__sub">{t("Başka bir role düşersen")}</h3>
          <p className="state__text">{t("Her rolde en çok kazandıran, oynaması kolay şampiyonlar.")}</p>
          <ul className="queue__list">{autofill.map((pick) => row(pick.championId, pick.position, pick.entry, { showRole: true }))}</ul>
        </>
      )}
    </section>
  );
}
