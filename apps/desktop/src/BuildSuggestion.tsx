import { useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getBuild, type Build } from "./api";
import {
  itemIconUrl,
  items,
  latestVersion,
  runeIconUrl,
  runes,
  spellIconUrl,
  summonerSpells,
  type Item,
  type RuneStyle,
  type SummonerSpell,
} from "./data/ddragon";
import { useAsync } from "./useAsync";

const FLASH = 4;
const SHOWN_ITEMS = 6;

type Data = {
  build: Build | null;
  version: string;
  runes: Map<number, RuneStyle>;
  spells: Map<number, SummonerSpell>;
  items: Map<number, Item>;
};

async function load(championId: number, position: string | null): Promise<Data> {
  const [build, version, runeStyles, spells, itemList] = await Promise.all([
    getBuild(championId, position),
    latestVersion(),
    runes(),
    summonerSpells(),
    items(),
  ]);
  return { build, version, runes: runeStyles, spells, items: itemList };
}

/** Keeps Flash on the key the player already has it on. */
export function orderSpells(recommended: number[], current: [number, number]): [number, number] {
  const [a, b] = recommended;
  if (a !== FLASH && b !== FLASH) return [a, b];
  const other = a === FLASH ? b : a;
  return current[0] === FLASH ? [FLASH, other] : [other, FLASH];
}

const percent = (rate: number) => `%${Math.round(rate * 100)}`;

type ImportState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; message: string }
  | { status: "error"; message: string }
  | { status: "choose"; pages: { id: number; name: string }[] };

type Props = {
  championId: number;
  championName: string;
  position: string | null;
  currentSpells: [number, number];
};

export function BuildSuggestion({ championId, championName, position, currentSpells }: Props) {
  const [state, retry] = useAsync(`${championId}:${position}`, () => load(championId, position));
  const [runeImport, setRuneImport] = useState<ImportState>({ status: "idle" });
  const [spellImport, setSpellImport] = useState<ImportState>({ status: "idle" });

  if (state.status === "error") {
    return (
      <div className="build">
        <p className="build__note">Öneri alınamadı.</p>
        <button type="button" className="button" onClick={retry}>
          Tekrar dene
        </button>
      </div>
    );
  }
  if (state.status !== "done") return <p className="build__note">Öneri yükleniyor</p>;

  const { build, version } = state.value;
  if (!build || build.runes.length === 0) {
    return <p className="build__note">{championName} için henüz yeterli maç yok. Vizier her gün daha fazla maç topluyor.</p>;
  }

  const page = build.runes[0];
  const primary = state.value.runes.get(page.primaryStyle);
  const sub = state.value.runes.get(page.subStyle);
  const runeById = new Map([...state.value.runes.values()].flatMap((s) => s.slots.flat().map((r) => [r.id, r] as const)));
  const spells = build.spells[0];
  const shownItems = build.items.filter((i) => state.value.items.get(i.id)?.complete).slice(0, SHOWN_ITEMS);

  async function importRunes(replacePageId?: number) {
    setRuneImport({ status: "working" });
    try {
      const result = await invoke<{ status: "imported" } | { status: "needsSlot"; pages: { id: number; name: string }[] }>(
        "import_runes",
        {
          page: {
            name: `Vizier ${championName}`,
            primaryStyleId: page.primaryStyle,
            subStyleId: page.subStyle,
            selectedPerkIds: page.perks,
          },
          replacePageId: replacePageId ?? null,
        },
      );
      setRuneImport(
        result.status === "imported"
          ? { status: "done", message: "Rünler aktarıldı" }
          : { status: "choose", pages: result.pages },
      );
    } catch {
      setRuneImport({ status: "error", message: "Rünler aktarılamadı. İstemci bağlantısını kontrol edip tekrar dene." });
    }
  }

  async function importSpells() {
    setSpellImport({ status: "working" });
    try {
      await invoke("import_spells", { spells: orderSpells(spells.ids, currentSpells) });
      setSpellImport({ status: "done", message: "Büyüler aktarıldı" });
    } catch {
      setSpellImport({ status: "error", message: "Büyüler aktarılamadı. Seçim kilitlendikten sonra değiştirilemez." });
    }
  }

  const canImport = isTauri();

  return (
    <div className="build">
      <p className="build__summary">
        Yama {build.patches[0]}, {build.games} maç, kazanma oranı {percent(build.winRate)}
      </p>

      <section className="build__block" aria-label="Önerilen rünler">
        <div className="build__runes">
          {primary && <img src={runeIconUrl(primary.icon)} alt={primary.name} title={primary.name} width={22} height={22} className="build__style" />}
          {page.perks.slice(0, 4).map((id, i) => {
            const rune = runeById.get(id);
            return rune ? (
              <img key={id} src={runeIconUrl(rune.icon)} alt={rune.name} title={rune.name} width={i === 0 ? 40 : 28} height={i === 0 ? 40 : 28} />
            ) : null;
          })}
          {sub && <img src={runeIconUrl(sub.icon)} alt={sub.name} title={sub.name} width={22} height={22} className="build__style" />}
          {page.perks.slice(4, 6).map((id) => {
            const rune = runeById.get(id);
            return rune ? <img key={id} src={runeIconUrl(rune.icon)} alt={rune.name} title={rune.name} width={24} height={24} /> : null;
          })}
        </div>
        <p className="build__stat">
          {page.games} maçta, {percent(page.winRate)} kazanma
        </p>
        <ImportControls
          label="Rünleri aktar"
          state={runeImport}
          disabled={!canImport}
          onImport={() => importRunes()}
          onChoose={(id) => importRunes(id)}
        />
      </section>

      {spells && (
        <section className="build__block" aria-label="Önerilen büyüler">
          <div className="build__row">
            {spells.ids.map((id) => {
              const spell = state.value.spells.get(id);
              return spell ? <img key={id} src={spellIconUrl(version, spell.id)} alt={spell.name} title={spell.name} width={30} height={30} /> : null;
            })}
            <span className="build__stat">{percent(spells.winRate)} kazanma</span>
          </div>
          <ImportControls label="Büyüleri aktar" state={spellImport} disabled={!canImport} onImport={importSpells} />
        </section>
      )}

      {shownItems.length > 0 && (
        <section className="build__block" aria-label="Sık alınan eşyalar">
          <div className="build__row">
            {shownItems.map((item) => {
              const info = state.value.items.get(item.id);
              return (
                <img
                  key={item.id}
                  src={itemIconUrl(version, item.id)}
                  alt={info?.name ?? ""}
                  title={`${info?.name ?? ""}: ${percent(item.games / build.games)} maçta alındı`}
                  width={30}
                  height={30}
                />
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function ImportControls({
  label,
  state,
  disabled,
  onImport,
  onChoose,
}: {
  label: string;
  state: ImportState;
  disabled: boolean;
  onImport: () => void;
  onChoose?: (pageId: number) => void;
}) {
  if (state.status === "choose" && onChoose) {
    return (
      <div className="build__choose" role="group" aria-label="Üzerine yazılacak rün sayfası">
        <p className="build__note">Boş rün sayfası yok. Hangisinin yerine yazılsın?</p>
        <div className="build__pages">
          {state.pages.map((p) => (
            <button key={p.id} type="button" className="button" onClick={() => onChoose(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="build__action">
      <button type="button" className="button" disabled={disabled || state.status === "working"} onClick={onImport}>
        {label}
      </button>
      {(state.status === "done" || state.status === "error") && (
        <span className="build__feedback" data-status={state.status} role="status">
          {state.message}
        </span>
      )}
    </div>
  );
}
