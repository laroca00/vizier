import { formatPercent, useLang, useT, type Lang } from "./i18n";
import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getBuild, type Build, type BuildStyle, type Foe, type Picks } from "./api";
import { readChosenStyle, saveChosenStyle, STYLE_NAMES } from "./buildStyles";
import {
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
  type RuneStyle,
  type SummonerSpell,
} from "./data/ddragon";
import { useSettings } from "./settings";
import { useAsync } from "./useAsync";

const FLASH = 4;
const SHOWN_ITEMS = 6;

type Data = {
  build: Build | null;
  version: string;
  runes: Map<number, RuneStyle>;
  spells: Map<number, SummonerSpell>;
  items: Map<number, Item>;
  champions: Map<number, Champion>;
};

async function load(championId: number, position: string | null, vs: number | null, queue: number): Promise<Data> {
  const [build, version, runeStyles, spells, itemList, championList] = await Promise.all([
    getBuild(championId, position, vs, queue),
    latestVersion(),
    runes(),
    summonerSpells(),
    items(),
    champions(),
  ]);
  return { build, version, runes: runeStyles, spells, items: itemList, champions: championList };
}

const FOE_LABELS: Record<Foe, string> = {
  ap: "Büyü hasarı ağırlıklı takıma karşı",
  ad: "Fiziksel hasar ağırlıklı takıma karşı",
  tank: "Tank ağırlıklı takıma karşı",
};

/** Reads the enemy picks seen so far the way the API reads finished games' teams. */
export function foesOf(enemies: number[], champs: Map<number, Pick<Champion, "magic" | "tank">>): Set<Foe> {
  const known = enemies.map((id) => champs.get(id)).filter((c) => c !== undefined);
  const magic = known.filter((c) => c.magic).length;
  const foes = new Set<Foe>();
  if (magic >= 3) foes.add("ap");
  if (known.length - magic >= 4) foes.add("ad");
  if (known.filter((c) => c.tank).length >= 2) foes.add("tank");
  return foes;
}

/** Keeps Flash on the key the player already has it on. */
export function orderSpells(recommended: number[], current: [number, number]): [number, number] {
  const [a, b] = recommended;
  if (a !== FLASH && b !== FLASH) return [a, b];
  const other = a === FLASH ? b : a;
  return current[0] === FLASH ? [FLASH, other] : [other, FLASH];
}

const percentIn = (lang: Lang) => (rate: number) => formatPercent(rate, lang);

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
  /** Auto-import waits for the pick to be locked. */
  locked: boolean;
  /** Lane opponent the player picked, if any. */
  vs: number | null;
  /** The client only takes summoner spells during champ select. */
  inDraft?: boolean;
  queue?: number;
  /** Enemy champions picked so far, for situational items. */
  enemies?: number[];
};

const SKILL_KEYS = ["", "Q", "W", "E", "R"];

export function BuildSuggestion({ championId, championName, position, currentSpells, locked, vs, inDraft = true, queue = 420, enemies = [] }: Props) {
  const percent = percentIn(useLang());
  const t = useT();
  const [state, retry] = useAsync(`${queue}:${championId}:${position}:${vs}`, () => load(championId, position, vs, queue));
  const [runeImport, setRuneImport] = useState<ImportState>({ status: "idle" });
  const [spellImport, setSpellImport] = useState<ImportState>({ status: "idle" });
  const [itemImport, setItemImport] = useState<ImportState>({ status: "idle" });
  const [chosenStyle, setChosenStyle] = useState<BuildStyle | null>(() => readChosenStyle(championId, position));
  useEffect(() => setChosenStyle(readChosenStyle(championId, position)), [championId, position]);
  const settings = useSettings();
  const autoImported = useRef<number | null>(null);
  const actions = useRef<{ runes?: () => void; spells?: () => void; items?: () => void }>({});

  const ready = state.status === "done" && state.value.build !== null && state.value.build.runes.length > 0;
  useEffect(() => {
    if (!locked || !ready || !isTauri() || autoImported.current === championId) return;
    autoImported.current = championId;
    if (settings.autoImportRunes) actions.current.runes?.();
    if (settings.autoImportSpells) actions.current.spells?.();
    if (settings.autoImportItems) actions.current.items?.();
  }, [locked, ready, championId, settings.autoImportRunes, settings.autoImportSpells, settings.autoImportItems]);

  if (state.status === "error") {
    return (
      <div className="build">
        <p className="build__note">{t("Öneri alınamadı.")}</p>
        <button type="button" className="button" onClick={retry}>
          {t("Tekrar dene")}
        </button>
      </div>
    );
  }
  if (state.status !== "done") return <p className="build__note">{t("Öneri yükleniyor")}</p>;

  const { build, version } = state.value;
  if (!build || build.runes.length === 0) {
    return <p className="build__note">{t("{champion} için henüz yeterli maç yok. Vizier her gün daha fazla maç topluyor.", { champion: championName })}</p>;
  }

  const variants = build.variants ?? [];
  // One style alone is the overall build under another name.
  const variant = variants.length >= 2 ? (variants.find((v) => v.style === chosenStyle) ?? variants[0]) : null;
  const picks: Picks = variant ?? build;
  const setName = variant ? `Vizier ${championName} ${t(STYLE_NAMES[variant.style])}` : `Vizier ${championName}`;
  const foes = foesOf(enemies, state.value.champions);
  const situational = [...(build.situational ?? [])].sort((a, b) => Number(foes.has(b.vs)) - Number(foes.has(a.vs)));

  function chooseStyle(style: BuildStyle) {
    setChosenStyle(style);
    saveChosenStyle(championId, position, style);
    setRuneImport({ status: "idle" });
    setSpellImport({ status: "idle" });
    setItemImport({ status: "idle" });
  }

  const page = picks.runes[0];
  const primary = state.value.runes.get(page.primaryStyle);
  const sub = state.value.runes.get(page.subStyle);
  const runeById = new Map([...state.value.runes.values()].flatMap((s) => s.slots.flat().map((r) => [r.id, r] as const)));
  const spells = picks.spells[0];
  const shownItems = picks.items.filter((i) => state.value.items.get(i.id)?.complete).slice(0, SHOWN_ITEMS);

  async function importRunes(replacePageId?: number) {
    setRuneImport({ status: "working" });
    try {
      const result = await invoke<{ status: "imported" } | { status: "needsSlot"; pages: { id: number; name: string }[] }>(
        "import_runes",
        {
          page: {
            name: setName,
            primaryStyleId: page.primaryStyle,
            subStyleId: page.subStyle,
            selectedPerkIds: page.perks,
          },
          replacePageId: replacePageId ?? null,
        },
      );
      setRuneImport(
        result.status === "imported"
          ? { status: "done", message: t("Rünler aktarıldı") }
          : { status: "choose", pages: result.pages },
      );
    } catch {
      setRuneImport({ status: "error", message: t("Rünler aktarılamadı. İstemci bağlantısını kontrol edip tekrar dene.") });
    }
  }

  async function importSpells() {
    setSpellImport({ status: "working" });
    try {
      await invoke("import_spells", { spells: orderSpells(spells.ids, currentSpells) });
      setSpellImport({ status: "done", message: t("Büyüler aktarıldı") });
    } catch {
      setSpellImport({ status: "error", message: t("Büyüler aktarılamadı. Seçim kilitlendikten sonra değiştirilemez.") });
    }
  }

  async function importItems() {
    setItemImport({ status: "working" });
    try {
      await invoke("import_item_set", {
        championId,
        title: setName,
        blocks: [
          ...(picks.startItems ? [{ title: t("Başlangıç"), items: picks.startItems.ids }] : []),
          ...(picks.coreItems ? [{ title: t("Ana eşyalar, bu sırayla"), items: picks.coreItems.ids }] : []),
          { title: t("Sık alınan eşyalar"), items: shownItems.map((i) => i.id) },
          ...situational.map((s) => ({ title: t(FOE_LABELS[s.vs]), items: s.items.map((i) => i.id) })),
        ],
      });
      setItemImport({ status: "done", message: t("Eşya seti aktarıldı") });
    } catch {
      setItemImport({ status: "error", message: t("Eşya seti aktarılamadı. İstemci bağlantısını kontrol edip tekrar dene.") });
    }
  }

  actions.current = { runes: () => importRunes(), spells: spells ? importSpells : undefined, items: shownItems.length ? importItems : undefined };
  const canImport = isTauri();

  return (
    <div className="build">
      <p className="build__summary">
        {t("Yama {patch}, {games} maç, kazanma oranı {rate}", { patch: build.patches[0], games: build.games, rate: percent(build.winRate) })}
        {vs && build.vs === null ? `. ${t("Bu eşleşme için yeterli maç yok; genel öneri gösteriliyor")}` : ""}
      </p>

      {variant && (
        <div className="build__styles" role="group" aria-label={t("Build türü")}>
          {variants.map((v) => (
            <button key={v.style} type="button" className="build__style-tab" aria-pressed={v === variant} onClick={() => chooseStyle(v.style)}>
              <span className="build__style-name">{t(STYLE_NAMES[v.style])}</span>
              <span className="build__style-meta">{t("{share} maç, {rate} kazanma", { share: percent(v.share), rate: percent(v.winRate) })}</span>
            </button>
          ))}
        </div>
      )}

      {picks.skills && (
        <section className="build__block" aria-label={t("Yetenek sırası")}>
          <p className="build__stat">
            {t("Yetenek sırası: önce {first}, en çok {max}", {
              first: picks.skills.firstLevels.map((s) => SKILL_KEYS[s]).join(", "),
              max: picks.skills.maxOrder.map((s) => SKILL_KEYS[s]).join(" > "),
            })}
          </p>
        </section>
      )}

      <section className="build__block" aria-label={t("Önerilen rünler")}>
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
          {t("{games} maçta, {rate} kazanma", { games: page.games, rate: percent(page.winRate) })}
        </p>
        <ImportControls
          label={t("Rünleri aktar")}
          state={runeImport}
          disabled={!canImport}
          onImport={() => importRunes()}
          onChoose={(id) => importRunes(id)}
        />
      </section>

      {spells && (
        <section className="build__block" aria-label={t("Önerilen büyüler")}>
          <div className="build__row">
            {spells.ids.map((id) => {
              const spell = state.value.spells.get(id);
              return spell ? <img key={id} src={spellIconUrl(version, spell.id)} alt={spell.name} title={spell.name} width={30} height={30} /> : null;
            })}
            <span className="build__stat">{t("{rate} kazanma", { rate: percent(spells.winRate) })}</span>
          </div>
          {inDraft && <ImportControls label={t("Büyüleri aktar")} state={spellImport} disabled={!canImport} onImport={importSpells} />}
        </section>
      )}

      {(picks.startItems || picks.coreItems) && (
        <section className="build__block" aria-label={t("Başlangıç ve ana eşyalar")}>
          {[picks.startItems && { label: t("Başlangıç"), ids: picks.startItems.ids }, picks.coreItems && { label: t("Ana eşyalar"), ids: picks.coreItems.ids }]
            .filter((row): row is { label: string; ids: number[] } => !!row)
            .map((row) => (
              <div className="build__row" key={row.label}>
                <span className="build__stat build__row-label">{row.label}</span>
                {row.ids.map((id, i) => {
                  const info = state.value.items.get(id);
                  return <img key={`${id}-${i}`} src={itemIconUrl(version, id)} alt={info?.name ?? ""} title={info?.name} width={28} height={28} />;
                })}
              </div>
            ))}
        </section>
      )}

      {shownItems.length > 0 && (
        <section className="build__block" aria-label={t("Sık alınan eşyalar")}>
          <div className="build__row">
            {shownItems.map((item) => {
              const info = state.value.items.get(item.id);
              return (
                <img
                  key={item.id}
                  src={itemIconUrl(version, item.id)}
                  alt={info?.name ?? ""}
                  title={t("{item}: {share} maçta alındı", { item: info?.name ?? "", share: percent(item.games / (variant ?? build).games) })}
                  width={30}
                  height={30}
                />
              );
            })}
          </div>
          <ImportControls label={t("Eşya setini aktar")} state={itemImport} disabled={!canImport} onImport={importItems} />
        </section>
      )}

      {situational.length > 0 && (
        <section className="build__block" aria-label={t("Duruma göre eşyalar")}>
          {situational.map((s) => (
            <div className="build__row build__situational" key={s.vs} data-active={foes.has(s.vs) || undefined}>
              <span className="build__stat build__row-label">
                {t(FOE_LABELS[s.vs])}
                {foes.has(s.vs) && <span className="build__match-tag">{t("Bu maç")}</span>}
              </span>
              {s.items.map((item) => {
                const info = state.value.items.get(item.id);
                return (
                  <img
                    key={item.id}
                    src={itemIconUrl(version, item.id)}
                    alt={info?.name ?? ""}
                    title={t("{item}: bu takımlara karşı {rate} kazanma", { item: info?.name ?? "", rate: percent(item.winRate) })}
                    width={28}
                    height={28}
                  />
                );
              })}
            </div>
          ))}
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
  const t = useT();
  if (state.status === "choose" && onChoose) {
    return (
      <div className="build__choose" role="group" aria-label={t("Üzerine yazılacak rün sayfası")}>
        <p className="build__note">{t("Boş rün sayfası yok. Hangisinin yerine yazılsın?")}</p>
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
