import { BootsSpells } from "./BootsSpells";
import { BuildPath } from "./BuildPath";
import { RunePageView } from "./RunePageView";
import { formatPercent, useLang, useT, type Lang } from "./i18n";
import { shardName } from "./library/RuneEditor";
import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getBuild, type Build, type BuildStyle, type Foe, type Picks } from "./api";
import { ProMatchups } from "./draft/ProMatchups";
import { fromPicks } from "./library/convert";
import { createBuild } from "./library/store";
import { positionLabel } from "./labels";
import { BuildCompare } from "./BuildCompare";
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
import { SkillOptions } from "./SkillOptions";
import { useAsync } from "./useAsync";
import { Button } from "./ui/Button";
import { ErrorState } from "./ui/States";
import { useToast } from "./ui/Toast";
import "./BuildSuggestion.css";

const FLASH = 4;
const SHOWN_ITEMS = 6;

type Data = {
  build: Build | null;
  /** The build against the lane opponent; its `vs` is null when that matchup has too few games. */
  versus: Build | null;
  version: string;
  runes: Map<number, RuneStyle>;
  spells: Map<number, SummonerSpell>;
  items: Map<number, Item>;
  champions: Map<number, Champion>;
};

async function load(championId: number, position: string | null, vs: number | null, queue: number): Promise<Data> {
  const [build, versus, version, runeStyles, spells, itemList, championList] = await Promise.all([
    getBuild(championId, position, null, queue),
    vs ? getBuild(championId, position, vs, queue) : null,
    latestVersion(),
    runes(),
    summonerSpells(),
    items(),
    champions(),
  ]);
  return { build, versus, version, runes: runeStyles, spells, items: itemList, champions: championList };
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

type Tab = "general" | "vs" | BuildStyle;

type Props = {
  championId: number;
  championName: string;
  position: string | null;
  currentSpells: [number, number];
  /** In champ select, imports wait for the pick to be locked; a hovered champion is a preview. */
  locked: boolean;
  /** Lane opponent, picked by the player or guessed. */
  vs: number | null;
  /** Pro games in this role, closest matchup first, under the win rate. */
  showPros?: boolean;
  /** The client only takes summoner spells during champ select. */
  inDraft?: boolean;
  queue?: number;
  /** Enemy champions picked so far, for situational items. */
  enemies?: number[];
};


export function BuildSuggestion({ championId, championName, position, currentSpells, locked, vs, showPros = false, inDraft = true, queue = 420, enemies = [] }: Props) {
  const lang = useLang();
  const percent = percentIn(lang);
  const t = useT();
  const toast = useToast();
  const [state, retry] = useAsync(`${queue}:${championId}:${position}:${vs}`, () => load(championId, position, vs, queue));
  const [runeImport, setRuneImport] = useState<ImportState>({ status: "idle" });
  const [spellImport, setSpellImport] = useState<ImportState>({ status: "idle" });
  const [itemImport, setItemImport] = useState<ImportState>({ status: "idle" });
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);
  // Results that land after the champion changed belong to the old pick.
  const currentChampion = useRef(championId);
  currentChampion.current = championId;
  useEffect(() => {
    setChosenTab(null);
    setRuneImport({ status: "idle" });
    setSpellImport({ status: "idle" });
    setItemImport({ status: "idle" });
  }, [championId, position, vs]);
  const settings = useSettings();
  const autoImported = useRef<number | null>(null);
  const actions = useRef<{ runes?: () => void; spells?: () => void; items?: () => void }>({});
  // The page being imported, so picking a page to overwrite keeps an alternative's runes.
  const pendingPage = useRef<number>(0);

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
        <ErrorState message={t("Öneri alınamadı.")} onRetry={retry} />
      </div>
    );
  }
  if (state.status !== "done") return <p className="build__note">{t("Öneri yükleniyor")}</p>;

  const { build, version } = state.value;
  if (!build || build.runes.length === 0) {
    return <p className="build__note">{t("{champion} için henüz yeterli maç yok. Vizier her gün daha fazla maç topluyor.", { champion: championName })}</p>;
  }

  // One style alone is the overall build under another name.
  const variants = build.variants && build.variants.length >= 2 ? build.variants : [];
  const versus = state.value.versus && state.value.versus.vs !== null && state.value.versus.runes.length > 0 ? state.value.versus : null;
  const opponentName = vs ? (state.value.champions.get(vs)?.name ?? "") : "";
  const saved = readChosenStyle(championId, position);
  const savedVariant = variants.find((v) => v.style === saved);
  const defaultTab: Tab = versus ? "vs" : (savedVariant?.style ?? "general");
  const isValid = (choice: Tab | null): choice is Tab =>
    choice === "general" || (choice === "vs" && versus !== null) || variants.some((v) => v.style === choice);
  const tab: Tab = isValid(chosenTab) ? chosenTab : defaultTab;
  const variant = variants.find((v) => v.style === tab) ?? null;
  const shown = tab === "vs" && versus ? versus : (variant ?? build);
  const picks: Picks = shown;
  const setName = variant ? `Vizier ${championName} ${t(STYLE_NAMES[variant.style])}` : `Vizier ${championName}`;
  const foes = foesOf(enemies, state.value.champions);
  const situational = [...(build.situational ?? [])].sort((a, b) => Number(foes.has(b.vs)) - Number(foes.has(a.vs)));

  function chooseTab(next: Tab) {
    setChosenTab(next);
    if (next !== "general" && next !== "vs") saveChosenStyle(championId, position, next);
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

  const stale = (forChampion: number) => currentChampion.current !== forChampion;

  function report(set: (next: ImportState) => void, forChampion: number, result: { status: "done" | "error"; message: string }) {
    if (stale(forChampion)) return;
    set(result);
    toast(result.status === "done" ? "success" : "error", result.message);
  }

  async function importRunes(replacePageId?: number, index = pendingPage.current) {
    pendingPage.current = index;
    const chosen = picks.runes[index] ?? page;
    const forChampion = championId;
    setRuneImport({ status: "working" });
    try {
      const result = await invoke<{ status: "imported" } | { status: "needsSlot"; pages: { id: number; name: string }[] }>(
        "import_runes",
        {
          page: {
            name: setName,
            primaryStyleId: chosen.primaryStyle,
            subStyleId: chosen.subStyle,
            selectedPerkIds: chosen.perks,
          },
          replacePageId: replacePageId ?? null,
        },
      );
      if (result.status === "imported") {
        report(setRuneImport, forChampion, { status: "done", message: t("{champion} rünleri aktarıldı", { champion: championName }) });
      } else if (!stale(forChampion)) {
        setRuneImport({ status: "choose", pages: result.pages });
        toast("info", t("Boş rün sayfası yok. Hangi sayfanın yerine yazılacağını build kartında seç."));
      }
    } catch {
      report(setRuneImport, forChampion, { status: "error", message: t("Rünler aktarılamadı. İstemci bağlantısını kontrol edip tekrar dene.") });
    }
  }

  async function importSpells() {
    const forChampion = championId;
    setSpellImport({ status: "working" });
    try {
      await invoke("import_spells", { spells: orderSpells(spells.ids, currentSpells) });
      report(setSpellImport, forChampion, { status: "done", message: t("{champion} büyüleri aktarıldı", { champion: championName }) });
    } catch {
      report(setSpellImport, forChampion, { status: "error", message: t("Büyüler aktarılamadı. Oyun başlamadan tekrar dene.") });
    }
  }

  async function importItems() {
    const forChampion = championId;
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
      report(setItemImport, forChampion, { status: "done", message: t("{champion} eşya seti aktarıldı", { champion: championName }) });
    } catch {
      report(setItemImport, forChampion, { status: "error", message: t("Eşya seti aktarılamadı. İstemci bağlantısını kontrol edip tekrar dene.") });
    }
  }

  actions.current = { runes: () => importRunes(undefined, 0), spells: spells ? importSpells : undefined, items: shownItems.length ? importItems : undefined };
  const preview = inDraft && !locked;
  const canImport = isTauri() && !preview;

  return (
    <div className="build">
      {(variants.length > 0 || versus) && (
        <div className="build__styles" role="group" aria-label={t("Build türü")}>
          <button type="button" className="build__style-tab" aria-pressed={tab === "general"} onClick={() => chooseTab("general")}>
            <span className="build__style-name">{t("Genel")}</span>
            <span className="build__style-meta">{t("{games} maç, {rate} kazanma", { games: build.games, rate: percent(build.winRate) })}</span>
          </button>
          {variants.map((v) => (
            <button key={v.style} type="button" className="build__style-tab" aria-pressed={tab === v.style} onClick={() => chooseTab(v.style)}>
              <span className="build__style-name">{t(STYLE_NAMES[v.style])}</span>
              <span className="build__style-meta">{t("{share} maç, {rate} kazanma", { share: percent(v.share), rate: percent(v.winRate) })}</span>
            </button>
          ))}
          {versus && (
            <button type="button" className="build__style-tab" aria-pressed={tab === "vs"} onClick={() => chooseTab("vs")}>
              <span className="build__style-name">{t("{opponent} karşısında", { opponent: opponentName })}</span>
              <span className="build__style-meta">{t("{games} maç, {rate} kazanma", { games: versus.games, rate: percent(versus.winRate) })}</span>
            </button>
          )}
        </div>
      )}

      <p className="build__summary">
        {/* Builds also count KR Challenger games, so this differs from the tier list's Emerald+ numbers. */}
        {t(queue === 420 ? "Yama {patch}, TR ve EUW Emerald+ ile KR Challenger'dan {games} maç, kazanma oranı {rate}" : "Yama {patch}, {games} maç, kazanma oranı {rate}", {
          patch: build.patches[0],
          games: shown.games,
          rate: percent(shown.winRate),
        })}
        {vs && !versus ? `. ${t("{opponent} eşleşmesi için yeterli maç yok; genel build gösteriliyor", { opponent: opponentName })}` : ""}
      </p>

      <div className="build__save">
        <Button
          size="small"
          variant="ghost"
          onClick={() => {
            const name = [championName, variant ? t(STYLE_NAMES[variant.style]) : null, tab === "vs" ? t("{opponent} karşısında", { opponent: opponentName }) : positionLabel(position ?? "", lang)]
              .filter(Boolean)
              .join(" ");
            createBuild(fromPicks({ name, championId, position: position ? position.toUpperCase() : null }, picks, (id) => !!state.value.items.get(id)?.complete));
            toast("success", t("{champion} buildlerine kaydedildi", { champion: championName }));
          }}
        >
          {t("Buildlerime kaydet")}
        </Button>
      </div>

      {showPros && <ProMatchups championId={championId} position={position} opponentId={vs} />}

      {preview && <p className="build__note build__preview">{t("Önizleme. Şampiyonu kilitleyince aktarabilirsin.")}</p>}

      {picks.skills && <SkillOptions key={`${championId}:${position}:${tab}`} skills={picks.skills} options={shown === build ? build.skillOptions : undefined} />}

      <section className="build__block" aria-label={t("Önerilen rünler")}>
        <RunePageView
          primary={primary}
          secondary={sub}
          perks={page.perks}
          counts={shown === build && page === picks.runes[0] ? build.perks : undefined}
          total={build.perkGames ?? build.games}
        />
        <p className="build__stat">
          {t("{games} maçta, {rate} kazanma", { games: page.games, rate: percent(page.winRate) })}
        </p>
        {page.perks.length === 9 && (
          <p className="build__stat build__shards">
            {t("Bonuslar: {shards}", { shards: page.perks.slice(6, 9).map((id, row) => t(shardName(row, id))).filter(Boolean).join(", ") })}
          </p>
        )}
        <ImportControls
          label={t("Rünleri aktar")}
          state={runeImport}
          disabled={!canImport}
          onImport={() => importRunes(undefined, 0)}
          onChoose={(id) => importRunes(id)}
          onCancel={() => setRuneImport({ status: "idle" })}
        />
        {picks.runes.length > 1 && (
          <div className="build__alternatives">
            <p className="build__stat">{t("Alternatif rün dizilimleri")}</p>
            {picks.runes.slice(1, 3).map((alt, i) => {
              const keystone = runeById.get(alt.perks[0]);
              const altSub = state.value.runes.get(alt.subStyle);
              return (
                <div className="build__row" key={alt.perks.join("-")}>
                  {keystone && <img src={runeIconUrl(keystone.icon)} alt="" width={26} height={26} />}
                  {alt.perks.slice(1, 4).map((id) => {
                    const rune = runeById.get(id);
                    return rune ? <img key={id} src={runeIconUrl(rune.icon)} alt={rune.name} title={rune.name} width={20} height={20} /> : null;
                  })}
                  {altSub && <img src={runeIconUrl(altSub.icon)} alt={altSub.name} title={altSub.name} width={18} height={18} className="build__style" />}
                  <span className="build__stat">
                    {keystone?.name}, {t("{games} maçta, {rate} kazanma", { games: alt.games, rate: percent(alt.winRate) })}
                  </span>
                  <Button size="small" disabled={!canImport} busy={runeImport.status === "working"} onClick={() => importRunes(undefined, i + 1)}>
                    {t("Bunu aktar")}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
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

      <BootsSpells picks={picks} total={shown.games} items={state.value.items} spells={state.value.spells} version={version} />

      <BuildPath picks={picks} items={state.value.items} version={version} />

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
                  title={t("{item}: {share} maçta alındı", { item: info?.name ?? "", share: percent(item.games / shown.games) })}
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

      <BuildCompare build={build} picks={picks} version={version} runes={state.value.runes} items={state.value.items} />
    </div>
  );
}

function ImportControls({
  label,
  state,
  disabled,
  onImport,
  onChoose,
  onCancel,
}: {
  label: string;
  state: ImportState;
  disabled: boolean;
  onImport: () => void;
  onChoose?: (pageId: number) => void;
  onCancel?: () => void;
}) {
  const t = useT();
  if (state.status === "choose" && onChoose) {
    return (
      <div className="build__choose" role="group" aria-label={t("Üzerine yazılacak rün sayfası")}>
        <p className="build__note">{t("Boş rün sayfası yok. Seçtiğin sayfadaki rünler silinip yerine bu sayfa yazılır.")}</p>
        <div className="build__pages">
          {state.pages.map((p) => (
            <Button key={p.id} onClick={() => onChoose(p.id)}>
              {t("{page} yerine yaz", { page: p.name })}
            </Button>
          ))}
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              {t("Vazgeç")}
            </Button>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="build__action">
      <Button variant="primary" disabled={disabled} busy={state.status === "working"} onClick={onImport}>
        {state.status === "error" ? t("Tekrar dene") : label}
      </Button>
      {(state.status === "done" || state.status === "error") && (
        <span className="build__feedback" data-status={state.status} role="status">
          {state.message}
        </span>
      )}
    </div>
  );
}
