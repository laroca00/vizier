import { useEffect, useId, useRef, useState } from "react";
import { championIconUrl, champions, latestVersion, type Champion } from "./data/ddragon";
import { fold } from "./fold";
import { useT } from "./i18n";
import { NavIcon, type IconName } from "./ui/NavIcon";
import { useAsync } from "./useAsync";
import "./SearchPalette.css";

const SHOWN = 8;

export type PaletteLink = { id: string; label: string; icon: IconName };

type Result = { kind: "page"; link: PaletteLink } | { kind: "champion"; champion: Champion };

/** Names that start with the query come first; matching pages lead. */
function search(query: string, list: Champion[], links: PaletteLink[]): Result[] {
  const needle = fold(query);
  if (!needle) return [];
  const rank = (name: string) => Number(!fold(name).startsWith(needle));
  const pages = links.filter((l) => fold(l.label).includes(needle)).sort((a, b) => rank(a.label) - rank(b.label));
  const champs = list
    .filter((c) => fold(c.name).includes(needle))
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, "tr"));
  return [...pages.map((link) => ({ kind: "page" as const, link })), ...champs.map((champion) => ({ kind: "champion" as const, champion }))].slice(0, SHOWN);
}

async function loadStatic() {
  const [version, byKey] = await Promise.all([latestVersion(), champions()]);
  return { version, list: [...byKey.values()] };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onChampion: (championId: number) => void;
  /** Sections of the app, already translated, reachable by name. */
  links?: PaletteLink[];
  onLink?: (id: string) => void;
};

export function SearchPalette({ open, onClose, onChampion, links = [], onLink }: Props) {
  const t = useT();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [data] = useAsync(open ? "static" : null, loadStatic);
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

  const results = search(query, data.status === "done" ? data.value.list : [], links);
  const version = data.status === "done" ? data.value.version : "";

  function choose(result: Result | undefined) {
    if (!result) return;
    onClose();
    if (result.kind === "champion") onChampion(result.champion.key);
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
                  key={result.kind === "champion" ? `c${result.champion.key}` : `p${result.link.id}`}
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
