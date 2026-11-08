import { intlLocale, useLang, useT, type Params } from "./i18n";
import { useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getProBuilds, type ProBuild, type ProFilter } from "./api";
import { STYLE_NAMES } from "./buildStyles";
import {
  championIconUrl,
  champions,
  itemIconUrl,
  items,
  latestVersion,
  runeIconUrl,
  runes,
  spellIconUrl,
  summonerSpells,
  type Champion,
  type Item,
  type Rune,
  type SummonerSpell,
} from "./data/ddragon";
import { shardName } from "./library/RuneEditor";
import { timeAgo } from "./labels";
import { useAsync } from "./useAsync";
import { fromPro } from "./library/convert";
import { createBuild } from "./library/store";
import { useToast } from "./ui/Toast";
import { useOpenPro } from "./proLink";
import { toggleFollow, usePersonal } from "./personal";
import { Button } from "./ui/Button";
import { ErrorState } from "./ui/States";
import "./ProBuildList.css";

export type ProStatic = {
  version: string;
  champions: Map<number, Champion>;
  items: Map<number, Item>;
  runes: Map<number, Rune>;
  spells: Map<number, SummonerSpell>;
};

export async function loadProStatic(): Promise<ProStatic> {
  const [version, byKey, itemList, styles, spells] = await Promise.all([latestVersion(), champions(), items(), runes(), summonerSpells()]);
  const runeById = new Map([...styles.values()].flatMap((s) => s.slots.flat().map((r) => [r.id, r] as const)));
  return { version, champions: byKey, items: itemList, runes: runeById, spells };
}

/** "primary:sub:p1,p2,p3,p4:s1,s2:offense,flex,defense" from the API, in LCU order. */
export function parseRunes(key: string) {
  const [primary, sub, primaryPerks, subPerks, shards] = key.split(":");
  return {
    primaryStyleId: Number(primary),
    subStyleId: Number(sub),
    selectedPerkIds: [primaryPerks, subPerks, shards].flatMap((group) => group.split(",").map(Number)),
  };
}

type ImportState = { status: "idle" | "working" } | { status: "done" | "error"; message: string };

async function importBuild(build: ProBuild, championName: string, finished: (id: number) => boolean, t: (text: string, params?: Params) => string): Promise<string> {
  const name = ["Vizier", build.player, championName, build.style ? t(STYLE_NAMES[build.style]) : ""].filter(Boolean).join(" ");
  const runeResult = await invoke<{ status: "imported" } | { status: "needsSlot" }>("import_runes", {
    page: { name, ...parseRunes(build.runes) },
    replacePageId: null,
  });
  // Buy order, finished items only, in the order the pro completed them.
  const core = [...new Set(build.purchases.filter(finished))];
  await invoke("import_item_set", {
    championId: build.championId,
    title: name,
    blocks: [
      ...(build.startItems.length ? [{ title: t("Başlangıç"), items: build.startItems }] : []),
      { title: t("{player} sırası", { player: build.player }), items: core.length ? core : build.items },
    ],
  });
  return runeResult.status === "imported"
    ? t("Rünler ve eşya seti aktarıldı")
    : t("Eşya seti aktarıldı. Rün sayfaların dolu; şampiyon seçiminde Vizier önerisinden bir sayfanın yerine yazabilirsin.");
}

type Props = {
  filter: ProFilter;
  /** Games of any of these players instead, newest first; the filter's limit applies to the merged list. */
  players?: string[];
  compact?: boolean;
  emptyText: string;
};

async function loadBuilds(filter: ProFilter, players?: string[]): Promise<ProBuild[]> {
  if (!players) return getProBuilds(filter);
  const lists = await Promise.all(players.map((player) => getProBuilds({ ...filter, player }).catch(() => [])));
  return lists
    .flat()
    .sort((a, b) => b.gameStart - a.gameStart)
    .slice(0, filter.limit ?? 30);
}

export function ProBuildList({ filter, players, compact = false, emptyText }: Props) {
  const t = useT();
  const key = JSON.stringify([filter, players]);
  const [state, retry] = useAsync(key, () => loadBuilds(filter, players));
  const [data] = useAsync("pro-static", loadProStatic);

  if (state.status === "error") {
    return (
      <ErrorState message={t("Pro maçları alınamadı.")} onRetry={retry} />
    );
  }
  if (state.status !== "done" || data.status !== "done") return <p className="build__note">{t("Pro maçları yükleniyor")}</p>;
  if (state.value.length === 0) return <p className="build__note">{emptyText}</p>;

  return (
    <ul className="pros" data-compact={compact || undefined}>
      {state.value.map((b) => (
        <ProRow key={`${b.matchId}-${b.player}`} build={b} data={data.value} compact={compact} />
      ))}
    </ul>
  );
}

function ProRow({ build, data, compact }: { build: ProBuild; data: ProStatic; compact: boolean }) {
  const t = useT();
  const lang = useLang();
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const [open, setOpen] = useState(false);
  const following = usePersonal().followed.includes(build.player);
  const toast = useToast();
  const openPro = useOpenPro();
  const champion = data.champions.get(build.championId);
  const opponent = build.opponentChampionId ? data.champions.get(build.opponentChampionId) : undefined;
  const keystone = data.runes.get(parseRunes(build.runes).selectedPerkIds[0]);
  const minutes = Math.round(build.duration / 60);

  async function onImport() {
    setImportState({ status: "working" });
    try {
      const message = await importBuild(build, champion?.name ?? "", (id) => !!data.items.get(id)?.complete, t);
      setImportState({ status: "done", message });
    } catch {
      setImportState({ status: "error", message: t("Aktarılamadı. League istemcisinin açık olduğundan emin ol.") });
    }
  }

  return (
    <li className="pros__row" data-result={build.win ? "win" : "loss"}>
      <span className="pros__who">
        <span className="pros__player">
          <button type="button" className="pros__name" onClick={() => openPro(build.player)}>
            {build.player}
          </button>
          <button
            type="button"
            className="pros__follow"
            aria-pressed={following}
            aria-label={following ? t("{player} takibini bırak", { player: build.player }) : t("{player} oyuncusunu takip et", { player: build.player })}
            title={following ? t("{player} takibini bırak", { player: build.player }) : t("{player} oyuncusunu takip et", { player: build.player })}
            onClick={() => toggleFollow(build.player)}
          >
            <svg viewBox="0 0 20 20" width={14} height={14} aria-hidden="true">
              <path d="M10 3.2l2 4.1 4.5.6-3.3 3.1.8 4.5L10 13.4l-4 2.1.8-4.5-3.3-3.1 4.5-.6z" />
            </svg>
          </button>
        </span>
        <span className="pros__team">
          {build.team || t("Takımsız")}
          {build.style && <span className="pros__style">{t(STYLE_NAMES[build.style])}</span>}
        </span>
      </span>
      <span className="pros__matchup">
        {champion && <img src={championIconUrl(data.version, champion.id)} alt={champion.name} title={champion.name} width={30} height={30} />}
        {opponent && (
          <>
            <span className="pros__vs">vs</span>
            <img src={championIconUrl(data.version, opponent.id)} alt={opponent.name} title={opponent.name} width={22} height={22} />
          </>
        )}
      </span>
      <span className="pros__kda">
        {build.kills}/{build.deaths}/{build.assists}
        {!compact && <span className="pros__sub">{t("{v} CS/dk", { v: Math.round((build.cs / Math.max(1, minutes)) * 10) / 10 })}</span>}
      </span>
      {keystone && <img className="pros__keystone" src={runeIconUrl(keystone.icon)} alt={keystone.name} title={keystone.name} width={26} height={26} />}
      <span className="pros__items">
        {build.items.map((id, i) => {
          const item = data.items.get(id);
          return <img key={`${id}-${i}`} src={itemIconUrl(data.version, id)} alt={item?.name ?? ""} title={item?.name} width={24} height={24} />;
        })}
      </span>
      {!compact && (
        <span className="pros__when">
          {timeAgo(build.gameStart + build.duration * 1000, lang)}
          <span className="pros__sub">{t("Yama {patch}", { patch: build.patch })}</span>
        </span>
      )}
      <span className="pros__action">
        {!compact && (
          <Button variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? t("Gizle") : t("Ayrıntı")}
          </Button>
        )}
        <Button disabled={!isTauri()} busy={importState.status === "working"} onClick={onImport}>
          {t("Aktar")}
        </Button>
        {!compact && (
          <Button
            variant="ghost"
            onClick={() => {
              createBuild(
                fromPro(
                  { name: [build.player, champion?.name].filter(Boolean).join(" "), championId: build.championId, position: build.position || null },
                  build,
                  (id) => !!data.items.get(id)?.complete,
                ),
              );
              toast("success", t("{champion} buildlerine kaydedildi", { champion: champion?.name ?? "" }));
            }}
          >
            {t("Kaydet")}
          </Button>
        )}
        {(importState.status === "done" || importState.status === "error") && (
          <span className="build__feedback" data-status={importState.status} role="status">
            {importState.message}
          </span>
        )}
      </span>
      {open && <ProDetail build={build} data={data} />}
    </li>
  );
}

const REGIONS: Record<string, string> = { kr: "KR", euw1: "EUW", tr1: "TR", na1: "NA" };

/** Everything stored about one pro game: full runes, spells, buy order, level-by-level skills. */
function ProDetail({ build, data }: { build: ProBuild; data: ProStatic }) {
  const t = useT();
  const lang = useLang();
  const perks = parseRunes(build.runes).selectedPerkIds;
  const bought = [...new Set(build.purchases.filter((id) => data.items.get(id)?.complete))];
  const minutes = Math.floor(build.duration / 60);
  const seconds = String(build.duration % 60).padStart(2, "0");
  const started = new Intl.DateTimeFormat(intlLocale(lang), { dateStyle: "medium", timeStyle: "short" }).format(build.gameStart);
  const facts = [
    t("{date}, {minutes}:{seconds} sürdü", { date: started, minutes, seconds }),
    t("Yama {patch}", { patch: build.patch }),
    REGIONS[build.platform] ?? build.platform.toUpperCase(),
    t("{cs} CS, {gold} altın", { cs: build.cs, gold: build.gold.toLocaleString(intlLocale(lang)) }),
  ];
  const icon = (id: number, size: number) => {
    const rune = data.runes.get(id);
    return rune ? <img key={id} src={runeIconUrl(rune.icon)} alt={rune.name} title={rune.name} width={size} height={size} /> : null;
  };
  return (
    <div className="pros__detail">
      <p className="build__note">{facts.join(", ")}</p>
      <div className="pros__detail-grid">
        <div>
          <p className="build__stat">{t("Rünler")}</p>
          <div className="build__runes">
            {perks.slice(0, 4).map((id, i) => icon(id, i === 0 ? 34 : 26))}
            <span className="pros__gap" />
            {perks.slice(4, 6).map((id) => icon(id, 24))}
          </div>
          <p className="build__stat">{perks.slice(6, 9).map((id, row) => t(shardName(row, id))).filter(Boolean).join(", ")}</p>
        </div>
        <div>
          <p className="build__stat">{t("Büyüler")}</p>
          <div className="build__row">
            {build.spells.map((id, i) => {
              const spell = [...data.spells.values()].find((s) => s.key === id);
              return spell ? <img key={i} src={spellIconUrl(data.version, spell.id)} alt={spell.name} title={spell.name} width={28} height={28} /> : null;
            })}
          </div>
        </div>
      </div>
      {[
        { label: "Başlangıç", ids: build.startItems },
        { label: "Alış sırası", ids: bought },
      ]
        .filter((row) => row.ids.length > 0)
        .map((row) => (
          <div className="build__row" key={row.label}>
            <span className="build__stat build__row-label">{t(row.label)}</span>
            {row.ids.map((id, i) => {
              const item = data.items.get(id);
              return <img key={`${id}-${i}`} src={itemIconUrl(data.version, id)} alt={item?.name ?? ""} title={item?.name} width={26} height={26} />;
            })}
          </div>
        ))}
      {build.skillOrder.length > 0 && <LevelGrid order={build.skillOrder} />}
    </div>
  );
}

const SKILL_KEYS = ["Q", "W", "E", "R"] as const;

/** The skills the pro actually levelled, level by level. */
function LevelGrid({ order }: { order: number[] }) {
  const t = useT();
  return (
    <div className="skillgrid" role="table" aria-label={t("Seviye seviye yetenek sırası")}>
      {SKILL_KEYS.map((key, slot) => (
        <div key={key} role="row" style={{ display: "contents" }}>
          <span className="skillgrid__key" role="rowheader">
            {key}
          </span>
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} role="cell" data-on={order[i] === slot + 1 || undefined} data-ult={key === "R" || undefined}>
              {order[i] === slot + 1 ? i + 1 : ""}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
