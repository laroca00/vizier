import { useEffect, useId, useRef, useState } from "react";
import { championIconUrl, champions, itemIconUrl, items, latestVersion, runeIconUrl, runes } from "./data/ddragon";
import { useLibrary } from "./library/store";
import type { Route } from "./router";
import { useT } from "./i18n";
import { NavIcon } from "./ui/NavIcon";
import { useAsync } from "./useAsync";
import { getProTeams } from "./api";
import { useOpenPro } from "./proLink";
import { guessPosition } from "./pages/matchupRoute";
import { search, type Entry, type PaletteLink, type Pro, type Result } from "./paletteSearch";

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

export function SearchPalette({ open, onClose, onChampion, links = [], onLink, onMatchup, onRoute }: Props) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [data] = useAsync(open ? "static" : null, loadStatic);
  const [pros] = useAsync(open ? "palette-pros" : null, loadPros);
  const [catalog] = useAsync(open ? "palette-catalog" : null, () => loadCatalog().catch(() => ({ items: [], runes: [] })));
  const library = useLibrary();
  const openPro = useOpenPro();
  const listId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setQuery("");
      setActive(0);
      element.showModal();
    }
    if (!open && element.open) element.close();
  }, [open]);

  const version = data.status === "done" ? data.value.version : "";
  const championIcon = (id: number) => {
    const c = data.status === "done" ? data.value.list.find((x) => x.key === id) : undefined;
    return c && version ? championIconUrl(version, c.id) : null;
  };
  const results = search(query, data.status === "done" ? data.value.list : [], links, pros.status === "done" ? pros.value : [], {
    builds: library.builds.map((b) => ({ id: b.id, name: b.name, icon: championIcon(b.championId) })),
    ...(catalog.status === "done" ? catalog.value : {}),
  });

  function choose(result: Result | undefined) {
    if (!result) return;
    onClose();
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
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(results[active]);
    }
  }

  const optionId = (i: number) => `${listId}-${i}`;

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
          }}
          onKeyDown={onKeyDown}
        />
        {query.trim() && (
          <ul className="palette__results" id={listId} role="listbox" aria-label={t("Sonuçlar")}>
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
                  key={
                    result.kind === "champion"
                      ? `c${result.champion.key}`
                      : result.kind === "matchup"
                        ? `m${result.a.key}:${result.b.key}`
                        : result.kind === "pro"
                          ? `r${result.pro.player}`
                          : result.kind === "build" || result.kind === "item" || result.kind === "rune"
                            ? `${result.kind}${result.entry.id}`
                          : `p${result.link.id}`
                  }
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  className="palette__option"
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(result)}
                >
                  {result.kind === "champion" ? (
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
                      <span className="palette__kind">{t("Bölüm")}</span>
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
