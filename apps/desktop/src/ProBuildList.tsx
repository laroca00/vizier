import { useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getProBuilds, type ProBuild, type ProFilter } from "./api";
import {
  championIconUrl,
  champions,
  itemIconUrl,
  items,
  latestVersion,
  runeIconUrl,
  runes,
  type Champion,
  type Item,
  type Rune,
} from "./data/ddragon";
import { timeAgo } from "./labels";
import { useAsync } from "./useAsync";

type Static = { version: string; champions: Map<number, Champion>; items: Map<number, Item>; runes: Map<number, Rune> };

async function loadStatic(): Promise<Static> {
  const [version, byKey, itemList, styles] = await Promise.all([latestVersion(), champions(), items(), runes()]);
  const runeById = new Map([...styles.values()].flatMap((s) => s.slots.flat().map((r) => [r.id, r] as const)));
  return { version, champions: byKey, items: itemList, runes: runeById };
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

async function importBuild(build: ProBuild, championName: string, finished: (id: number) => boolean): Promise<string> {
  const name = `Vizier ${build.player} ${championName}`;
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
      ...(build.startItems.length ? [{ title: "Başlangıç", items: build.startItems }] : []),
      { title: `${build.player} sırası`, items: core.length ? core : build.items },
    ],
  });
  return runeResult.status === "imported"
    ? "Rünler ve eşya seti aktarıldı"
    : "Eşya seti aktarıldı. Rün sayfaların dolu; şampiyon seçiminde Vizier önerisinden bir sayfanın yerine yazabilirsin.";
}

type Props = { filter: ProFilter; compact?: boolean; emptyText: string };

export function ProBuildList({ filter, compact = false, emptyText }: Props) {
  const key = `${filter.championId ?? ""}:${filter.position ?? ""}:${filter.team ?? ""}:${filter.limit ?? ""}`;
  const [state, retry] = useAsync(key, () => getProBuilds(filter));
  const [data] = useAsync("static", loadStatic);

  if (state.status === "error") {
    return (
      <div role="alert">
        <p className="build__note">Pro maçları alınamadı.</p>
        <button type="button" className="button" onClick={retry}>
          Tekrar dene
        </button>
      </div>
    );
  }
  if (state.status !== "done" || data.status !== "done") return <p className="build__note">Pro maçları yükleniyor</p>;
  if (state.value.length === 0) return <p className="build__note">{emptyText}</p>;

  return (
    <ul className="pros" data-compact={compact || undefined}>
      {state.value.map((b) => (
        <ProRow key={`${b.matchId}-${b.player}`} build={b} data={data.value} compact={compact} />
      ))}
    </ul>
  );
}

function ProRow({ build, data, compact }: { build: ProBuild; data: Static; compact: boolean }) {
  const [importState, setImportState] = useState<ImportState>({ status: "idle" });
  const champion = data.champions.get(build.championId);
  const opponent = build.opponentChampionId ? data.champions.get(build.opponentChampionId) : undefined;
  const keystone = data.runes.get(parseRunes(build.runes).selectedPerkIds[0]);
  const minutes = Math.round(build.duration / 60);

  async function onImport() {
    setImportState({ status: "working" });
    try {
      const message = await importBuild(build, champion?.name ?? "", (id) => !!data.items.get(id)?.complete);
      setImportState({ status: "done", message });
    } catch {
      setImportState({ status: "error", message: "Aktarılamadı. League istemcisinin açık olduğundan emin ol." });
    }
  }

  return (
    <li className="pros__row" data-result={build.win ? "win" : "loss"}>
      <span className="pros__who">
        <span className="pros__player">{build.player}</span>
        <span className="pros__team">{build.team}</span>
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
        {!compact && <span className="pros__sub">{Math.round(build.cs / Math.max(1, minutes) * 10) / 10} CS/dk</span>}
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
          {timeAgo(build.gameStart + build.duration * 1000)}
          <span className="pros__sub">Yama {build.patch}</span>
        </span>
      )}
      <span className="pros__action">
        <button type="button" className="button" disabled={!isTauri() || importState.status === "working"} onClick={onImport}>
          Aktar
        </button>
        {(importState.status === "done" || importState.status === "error") && (
          <span className="build__feedback" data-status={importState.status} role="status">
            {importState.message}
          </span>
        )}
      </span>
    </li>
  );
}
