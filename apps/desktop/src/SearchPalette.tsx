import { useEffect, useId, useMemo, useRef, useState } from "react";
import { championIconUrl, champions, itemIconUrl, items, latestVersion, runeIconUrl, runes } from "./data/ddragon";
import { useLibrary } from "./library/store";
import type { Route } from "./router";
import { useLang, useT } from "./i18n";
import { usePersonal } from "./personal";
import { abilityTopics } from "./search/abilities";
import { addRecent, readRecent, writeRecent } from "./search/recent";
import { comboTopics, noteTopics, staticTopics, type Topic } from "./search/topics";
import { Tabs } from "./ui/Tabs";
import { NavIcon, type IconName } from "./ui/NavIcon";
import { useAsync } from "./useAsync";
import { getProTeams } from "./api";
import { useOpenPro } from "./proLink";
import { guessPosition } from "./pages/matchupRoute";
import { COMMAND_PREFIX } from "./commands";
import { CATEGORIES, CATEGORY_TEXT, search, type Category, type Entry, type PaletteLink, type Pro, type Result } from "./paletteSearch";

export type { PaletteLink };
import "./SearchPalette.css";

// The palette still finds champions when the pro list can't be loaded.
const loadPros = (): Promise<Pro[]> =>
  getProTeams().then(
    (teams) => teams.flatMap((entry) => entry.players.map((player) => ({ player, team: entry.team }))),
    () => [],
  );

async function loadStatic() {
  const [version, byKey] = await Promise.all([latestVersion(), champions()]);
  return { version, list: [...byKey.values()] };
}

// Finished items and keystones, the two lists the item and rune explorers show.
async function loadCatalog(): Promise<{ items: Entry[]; runes: Entry[] }> {
  const [version, itemList, styles] = await Promise.all([latestVersion(), items(), runes()]);
  return {
    // Data Dragon repeats an item under other ids for Arena and other modes; the lowest id is the Rift one.
    items: [...new Map([...itemList.values()].filter((i) => i.complete).sort((a, b) => b.id - a.id).map((i) => [i.name, i])).values()]
      .sort((a, b) => a.id - b.id)
      .map((i) => ({ id: String(i.id), name: i.name, icon: itemIconUrl(version, i.id) })),
    runes: [...styles.values()].flatMap((style) => style.slots[0] ?? []).map((r) => ({ id: String(r.id), name: r.name, icon: runeIconUrl(r.icon) })),
  };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onChampion: (championId: number) => void;
  /** Sections of the app, already translated, reachable by name. */
  links?: PaletteLink[];
  onLink?: (id: string) => void;
  /** Opens the matchup page for "Ahri vs Zed". */
  onMatchup?: (championId: number, opponentId: number, position: string) => void;
  /** Opens a saved build, an item or a keystone on its page. */
  onRoute?: (route: Route) => void;
};

const KIND_NAMES = { build: "Build", item: "Eşya", rune: "Ana rün" } as const;

const GROUP_NAMES: Record<Topic["group"], string> = {
  archetype: "Şampiyon tipi",
  template: "Takım şablonu",
  lab: "Eşya laboratuvarı",
  quiz: "Bilmece",
  academy: "Akademi",
  combo: "Kombo",
  note: "Notun",
  ability: "Yetenek",
};

const GROUP_ICONS: Record<Topic["group"], IconName> = {
  archetype: "archetypes",
  template: "simulator",
  lab: "lab",
  quiz: "quiz",
  academy: "matchup",
  combo: "combos",
  note: "journal",
  ability: "champions",
};

/** A past search shown while the box is empty. */
type Recent = { kind: "recent"; query: string };
type Row = Result | Recent;

const PAGE = 5;

function rowKey(row: Row): string {
  switch (row.kind) {
    case "recent":
      return `q${row.query}`;
    case "topic":
      return `t${row.topic.id}`;
    case "champion":
      return `c${row.champion.key}`;
    case "matchup":
      return `m${row.a.key}:${row.b.key}`;
    case "pro":
      return `r${row.pro.player}`;
    case "build":
    case "item":
    case "rune":
      return `${row.kind}${row.entry.id}`;
    case "page":
      return `p${row.link.id}`;
  }
}

export function SearchPalette({ open, onClose, onChampion, links = [], onLink, onMatchup, onRoute }: Props) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [category, setCategory] = useState<Category>("all");
  const [recent, setRecent] = useState<string[]>(readRecent);
  const lang = useLang();
  const { notes, recent: recentChampions } = usePersonal();
  const [data] = useAsync(open ? "static" : null, loadStatic);
  const [pros] = useAsync(open ? "palette-pros" : null, loadPros);
  const [catalog] = useAsync(open ? "palette-catalog" : null, () => loadCatalog().catch(() => ({ items: [], runes: [] })));
  // Ability names come from one larger file, so they are only fetched once the player types enough to look for one.
  const [abilities] = useAsync(open && query.trim().length >= 3 ? `palette-abilities:${lang}` : null, () => abilityTopics(lang).catch(() => [] as Topic[]));
  const library = useLibrary();
  const openPro = useOpenPro();
  const listId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setQuery("");
      setActive(0);
      setCategory("all");
      setRecent(readRecent());
      element.showModal();
    }
    if (!open && element.open) element.close();
  }, [open]);

  const version = data.status === "done" ? data.value.version : "";
  const championIcon = (id: number) => {
    const c = data.status === "done" ? data.value.list.find((x) => x.key === id) : undefined;
    return c && version ? championIconUrl(version, c.id) : null;
  };
  const list = data.status === "done" ? data.value.list : null;
  const topics = useMemo(() => {
    const byKey = new Map((list ?? []).map((c) => [c.key, c.name]));
    const nameOf = (id: number) => byKey.get(id) ?? String(id);
    return [...staticTopics(lang), ...comboTopics(list ?? [], lang), ...noteTopics(notes, nameOf)];
  }, [list, lang, notes]);
  const allTopics = abilities.status === "done" ? [...topics, ...abilities.value] : topics;
  const extras = {
    builds: library.builds.map((b) => ({ id: b.id, name: b.name, icon: championIcon(b.championId) })),
    ...(catalog.status === "done" ? catalog.value : {}),
    topics: allTopics,
  };
  const found = (cat: Category) => search(query, list ?? [], links, pros.status === "done" ? pros.value : [], extras, cat);
  const typed = query.trim().length > 0;
  const shownResults = found(category);
  // Tabs appear only for the categories that have something, so none leads nowhere.
  const tabs = typed ? CATEGORIES.filter((c) => c === "all" || c === category || found(c).length > 0) : [];
  const suggestions: Row[] = [
    ...recent.map((q): Recent => ({ kind: "recent", query: q })),
    ...recentChampions.flatMap((id) => {
      const champion = list?.find((c) => c.key === id);
      return champion ? [{ kind: "champion" as const, champion }] : [];
    }).slice(0, 4),
    ...links.slice(0, 4).map((link) => ({ kind: "page" as const, link })),
  ];
  const results: Row[] = typed ? shownResults : suggestions;

  function choose(result: Row | undefined) {
    if (!result) return;
    if (result.kind === "recent") {
      setQuery(result.query);
      setActive(0);
      return;
    }
    if (typed) {
      const next = addRecent(recent, query);
      setRecent(next);
      writeRecent(next);
    }
    onClose();
    if (result.kind === "topic") {
      const target = result.topic.target;
      if ("champion" in target) onChampion(target.champion);
      else onRoute?.(target.route);
      return;
    }
    if (result.kind === "champion") onChampion(result.champion.key);
    else if (result.kind === "matchup") onMatchup?.(result.a.key, result.b.key, guessPosition(result.a));
    else if (result.kind === "pro") openPro(result.pro.player);
    else if (result.kind === "build") onRoute?.({ page: "builds", buildId: result.entry.id });
    else if (result.kind === "item") onRoute?.({ page: "items", itemId: Number(result.entry.id) });
    else if (result.kind === "rune") onRoute?.({ page: "runes", runeId: Number(result.entry.id) });
    else onLink?.(result.link.id);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (results.length ? (i + step + results.length) % results.length : 0));
    } else if (event.key === "Home" || event.key === "End") {
      // Only when the cursor has nowhere to go in the text itself.
      if (query.length > 0 && !event.ctrlKey) return;
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : Math.max(results.length - 1, 0));
    } else if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      setActive((i) => Math.min(Math.max(i + (event.key === "PageDown" ? PAGE : -PAGE), 0), Math.max(results.length - 1, 0)));
    } else if ((event.ctrlKey || event.altKey) && (event.key === "ArrowRight" || event.key === "ArrowLeft") && tabs.length > 1) {
      event.preventDefault();
      const at = tabs.indexOf(category);
      setCategory(tabs[(at + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length]);
      setActive(0);
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  }

  const optionId = (i: number) => `${listId}-${i}`;

  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" });
  }, [active, listId]);

  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label={t("Ara")}
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
    >
      <div className="palette__box">
        <input
          className="palette__input"
          type="search"
          placeholder={t("Şampiyon ya da bölüm ara")}
          aria-label={t("Şampiyon ya da bölüm ara")}
          autoFocus
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls={listId}
          aria-activedescendant={results.length ? optionId(active) : undefined}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setCategory("all");
          }}
          onKeyDown={onKeyDown}
        />
        {tabs.length > 1 && (
          <Tabs className="palette__tabs" size="small" label={t("Sonuç türü")} items={tabs.map((c) => ({ id: c, label: t(CATEGORY_TEXT[c]) }))} value={category} onChange={(c) => { setCategory(c); setActive(0); }} />
        )}
        {(typed || results.length > 0) && (
          <ul className="palette__results" id={listId} role="listbox" aria-label={typed ? t("Sonuçlar") : t("Öneriler")}>
            {results.length === 0 ? (
              <li className="palette__empty">
                {data.status === "error"
                  ? t("Şampiyon listesi yüklenemedi. İnternet bağlantını kontrol et.")
                  : data.status !== "done"
                    ? t("Şampiyonlar yükleniyor")
                    : t("Bu adla bir şampiyon ya da bölüm yok.")}
              </li>
            ) : (
              results.map((result, i) => (
                <li
                  key={rowKey(result)}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  className="palette__option"
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(result)}
                >
                  {result.kind === "recent" ? (
                    <>
                      <span className="palette__page-icon">
                        <NavIcon name="search" size={18} />
                      </span>
                      <span>{result.query}</span>
                      <span className="palette__kind">{t("Son arama")}</span>
                    </>
                  ) : result.kind === "topic" ? (
                    <>
                      <span className="palette__page-icon">
                        <NavIcon name={GROUP_ICONS[result.topic.group]} size={18} />
                      </span>
                      <span>{result.topic.name}</span>
                      <span className="palette__kind">{t(GROUP_NAMES[result.topic.group])}</span>
                    </>
                  ) : result.kind === "champion" ? (
                    <>
                      <img src={championIconUrl(version, result.champion.id)} alt="" width={28} height={28} />
                      <span>{result.champion.name}</span>
                      <span className="palette__kind">{t("Şampiyon")}</span>
                    </>
                  ) : result.kind === "matchup" ? (
                    <>
                      <img src={championIconUrl(version, result.a.id)} alt="" width={28} height={28} />
                      <span>{t("{a} - {b}", { a: result.a.name, b: result.b.name })}</span>
                      <span className="palette__kind">{t("Eşleşme")}</span>
                    </>
                  ) : result.kind === "build" || result.kind === "item" || result.kind === "rune" ? (
                    <>
                      {result.entry.icon ? <img src={result.entry.icon} alt="" width={28} height={28} /> : <span className="palette__page-icon" />}
                      <span>{result.entry.name}</span>
                      <span className="palette__kind">{t(KIND_NAMES[result.kind])}</span>
                    </>
                  ) : result.kind === "pro" ? (
                    <>
                      <span className="palette__page-icon">
                        <NavIcon name="pros" size={18} />
                      </span>
                      <span>{result.pro.team ? t("{player} ({team})", { player: result.pro.player, team: result.pro.team }) : result.pro.player}</span>
                      <span className="palette__kind">{t("Pro oyuncu")}</span>
                    </>
                  ) : (
                    <>
                      <span className="palette__page-icon">
                        <NavIcon name={result.link.icon} size={18} />
                      </span>
                      <span>{result.link.label}</span>
                      <span className="palette__kind">{result.link.id.startsWith(COMMAND_PREFIX) ? t("Komut") : t("Bölüm")}</span>
                    </>
                  )}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </dialog>
  );
}
