import { useEffect, useId, useRef, useState } from "react";
import { championIconUrl, champions, latestVersion, type Champion } from "./data/ddragon";
import { useT } from "./i18n";
import { useAsync } from "./useAsync";
import "./SearchPalette.css";

const SHOWN = 8;

/** "Kai'Sa", "kaisa" and "KAİSA" all match each other. */
export function fold(text: string) {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/** Names that start with the query come first. */
function search(query: string, list: Champion[]): Champion[] {
  const needle = fold(query);
  if (!needle) return [];
  return list
    .filter((c) => fold(c.name).includes(needle))
    .sort((a, b) => Number(!fold(a.name).startsWith(needle)) - Number(!fold(b.name).startsWith(needle)) || a.name.localeCompare(b.name, "tr"))
    .slice(0, SHOWN);
}

async function loadStatic() {
  const [version, byKey] = await Promise.all([latestVersion(), champions()]);
  return { version, list: [...byKey.values()] };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onChampion: (championId: number) => void;
};

export function SearchPalette({ open, onClose, onChampion }: Props) {
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

  const results = data.status === "done" ? search(query, data.value.list) : [];
  const version = data.status === "done" ? data.value.version : "";

  function choose(champion: Champion | undefined) {
    if (!champion) return;
    onClose();
    onChampion(champion.key);
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
          placeholder={t("Şampiyon ara")}
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
                    : t("Bu adla bir şampiyon yok.")}
              </li>
            ) : (
              results.map((champion, i) => (
                <li
                  key={champion.key}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  className="palette__option"
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(champion)}
                >
                  <img src={championIconUrl(version, champion.id)} alt="" width={28} height={28} />
                  <span>{champion.name}</span>
                  <span className="palette__kind">{t("Şampiyon")}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </dialog>
  );
}
