import { useEffect, useId, useRef, useState } from "react";
import { championIconUrl, champions, latestVersion, type Champion } from "./data/ddragon";
import type { Platform } from "./lcu";
import { useAsync } from "./useAsync";

export type RiotId = { gameName: string; tagLine: string; platform: Platform };

type Result = { kind: "profile"; riotId: RiotId } | { kind: "champion"; champion: Champion };

const SERVERS: { platform: Platform; label: string }[] = [
  { platform: "euw1", label: "EUW" },
  { platform: "tr1", label: "TR" },
];

const SHOWN = 8;
// Same limits the API checks: 3-16 character names, 3-5 character tags.
const RIOT_ID = /^(.{3,16})#([\p{L}\p{N}]{3,5})$/u;

/** "Kai'Sa", "kaisa" and "KAİSA" all match each other. */
export function fold(text: string) {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function parseRiotId(query: string): Omit<RiotId, "platform"> | null {
  const match = RIOT_ID.exec(query.trim());
  return match ? { gameName: match[1].trim(), tagLine: match[2] } : null;
}

/** A Riot ID is offered on both servers, the player's own first. */
function search(query: string, list: Champion[], home: Platform): Result[] {
  const parsed = parseRiotId(query);
  const servers = [...SERVERS].sort((a, b) => Number(b.platform === home) - Number(a.platform === home));
  const profiles = parsed ? servers.map(({ platform }) => ({ kind: "profile" as const, riotId: { ...parsed, platform } })) : [];
  const needle = fold(query);
  const matches = needle
    ? list
        .filter((c) => fold(c.name).includes(needle))
        .sort((a, b) => Number(!fold(a.name).startsWith(needle)) - Number(!fold(b.name).startsWith(needle)) || a.name.localeCompare(b.name, "tr"))
        .slice(0, SHOWN)
    : [];
  return [...profiles, ...matches.map((champion) => ({ kind: "champion" as const, champion }))];
}

async function loadStatic() {
  const [version, byKey] = await Promise.all([latestVersion(), champions()]);
  return { version, list: [...byKey.values()] };
}

type Props = {
  open: boolean;
  onClose: () => void;
  onChampion: (championId: number) => void;
  onProfile: (riotId: RiotId) => void;
  /** The player's own server, offered first for a Riot ID. */
  home: Platform;
};

export function SearchPalette({ open, onClose, onChampion, onProfile, home }: Props) {
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

  const results = data.status === "done" ? search(query, data.value.list, home) : [];
  const version = data.status === "done" ? data.value.version : "";

  function choose(result: Result | undefined) {
    if (!result) return;
    onClose();
    if (result.kind === "profile") onProfile(result.riotId);
    else onChampion(result.champion.key);
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
      aria-label="Ara"
      onClose={onClose}
      onClick={(event) => event.target === dialog.current && onClose()}
    >
      <div className="palette__box">
        <input
          className="palette__input"
          type="search"
          placeholder="Şampiyon ya da Riot ID (Ad#TR1)"
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
          <ul className="palette__results" id={listId} role="listbox" aria-label="Sonuçlar">
            {results.length === 0 ? (
              <li className="palette__empty">
                {data.status === "error"
                  ? "Şampiyon listesi yüklenemedi. İnternet bağlantını kontrol et."
                  : data.status !== "done"
                    ? "Şampiyonlar yükleniyor"
                    : query.includes("#")
                    ? "Riot ID, Ad#Etiket biçiminde olmalı. Etiket 3-5 harf ya da rakam."
                    : "Bu adla bir şampiyon yok. Bir oyuncu arıyorsan etiketiyle yaz: Ad#TR1"}
              </li>
            ) : (
              results.map((result, i) => (
                <li
                  key={result.kind === "profile" ? result.riotId.platform : result.champion.key}
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === active}
                  className="palette__option"
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(result)}
                >
                  {result.kind === "profile" ? (
                    <>
                      <span className="palette__glyph" aria-hidden="true">
                        #
                      </span>
                      <span>
                        {result.riotId.gameName}
                        <span className="profile__tag">#{result.riotId.tagLine}</span>
                      </span>
                      <span className="palette__kind">{SERVERS.find((s) => s.platform === result.riotId.platform)?.label} profili</span>
                    </>
                  ) : (
                    <>
                      <img src={championIconUrl(version, result.champion.id)} alt="" width={28} height={28} />
                      <span>{result.champion.name}</span>
                      <span className="palette__kind">Şampiyon</span>
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
