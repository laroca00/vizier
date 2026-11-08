import { useEffect, useState } from "react";
import { championIconUrl, type Champion } from "./data/ddragon";
import { useLang, useT } from "./i18n";
import { noteToStore } from "./journal";
import { matchupNoteKey, notedMatchups, setNote, usePersonal } from "./personal";

/** A matchup note starts with these headings; the player deletes the ones they don't need. */
export function useMatchupTemplate(): string {
  const t = useT();
  return [t("Hat planı"), t("Hepsini verme penceresi"), t("Kaçınılacaklar")].map((h) => `${h}:\n\n`).join("");
}

/**
 * A note the player keeps for a champion or a matchup; saved as they type.
 * An untouched `template` is shown in an empty note but never saved.
 */
export function JournalNote({ noteKey, label, placeholder, template }: { noteKey: string; label: string; placeholder?: string; template?: string }) {
  const t = useT();
  const { notes } = usePersonal();
  const start = (key: string) => notes[key] ?? template ?? "";
  const [text, setText] = useState(start(noteKey));
  const [shownKey, setShownKey] = useState(noteKey);
  const [saved, setSaved] = useState(false);

  // Another note opened in the same spot, e.g. a different matchup.
  if (shownKey !== noteKey) {
    setShownKey(noteKey);
    setText(start(noteKey));
  }

  useEffect(() => {
    const value = noteToStore(text, template);
    if (value === (notes[noteKey] ?? "")) return;
    const timer = setTimeout(() => {
      setNote(noteKey, value);
      setSaved(true);
    }, 500);
    return () => clearTimeout(timer);
  }, [text, template, noteKey, notes]);

  return (
    <label className="journal">
      <span className="draft__heading">{label}</span>
      <textarea
        value={text}
        placeholder={placeholder ?? t("Kendine not: neye dikkat etmelisin, ne işe yaradı?")}
        onChange={(e) => {
          setSaved(false);
          setText(e.target.value);
        }}
      />
      <p className="journal__saved" aria-live="polite">
        {saved ? t("Kaydedildi, yalnızca bu bilgisayarda") : ""}
      </p>
    </label>
  );
}

/** Notes per opponent: pick one from the list or from the ones already written. */
export function MatchupNotes({ championId, champions, version }: { championId: number; champions: Map<number, Champion>; version: string | null }) {
  const t = useT();
  const lang = useLang();
  const template = useMatchupTemplate();
  const personal = usePersonal();
  const noted = notedMatchups(personal, championId);
  const [opponent, setOpponent] = useState<number | null>(noted[0] ?? null);
  const [query, setQuery] = useState("");
  const byName = new Map([...champions.values()].map((c) => [c.name.toLocaleLowerCase(lang), c]));

  return (
    <div className="journal">
      <span className="draft__heading">{t("Eşleşme notların")}</span>
      <div className="goals__form">
        <input
          list="matchup-champions"
          value={query}
          placeholder={t("Rakip şampiyon")}
          aria-label={t("Rakip şampiyon")}
          onChange={(e) => {
            setQuery(e.target.value);
            const hit = byName.get(e.target.value.trim().toLocaleLowerCase(lang));
            if (hit && hit.key !== championId) setOpponent(hit.key);
          }}
        />
        <datalist id="matchup-champions">
          {[...champions.values()].map((c) => (
            <option key={c.key} value={c.name} />
          ))}
        </datalist>
      </div>
      {noted.length > 0 && (
        <ul className="strip strip--pickable">
          {noted.map((id) => {
            const c = champions.get(id);
            return (
              <li key={id}>
                <button type="button" className="strip__pick" aria-pressed={opponent === id} title={c?.name} onClick={() => setOpponent(id)}>
                  {c && version && <img src={championIconUrl(version, c.id)} alt={c.name} width={28} height={28} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {opponent !== null && (
        <JournalNote
          template={template}
          noteKey={matchupNoteKey(championId, opponent)}
          label={t("{opponent} karşısında", { opponent: champions.get(opponent)?.name ?? "" })}
          placeholder={t("Bu rakibe karşı ne işe yaradı?")}
        />
      )}
    </div>
  );
}
