import { useState } from "react";
import { ACADEMY_LIMIT, ACADEMY_TEXT_LIMIT, type AcademyKind } from "./academyNotes";
import { useT } from "./i18n";
import { addAcademyNote, removeAcademyNote, usePersonal } from "./personal";
import { Button } from "./ui/Button";

const KINDS: { kind: AcademyKind; title: string; placeholder: string }[] = [
  { kind: "reminders", title: "Hatırlatmalar", placeholder: "Örn. 3. seviyede E'yi bekle" },
  { kind: "plans", title: "Favori planlar", placeholder: "Örn. ilk eve dönüşte kılıç al" },
];

/** Short reminders and plans for one matchup, kept on top of the free-text note. */
export function AcademyNotes({ noteKey }: { noteKey: string }) {
  const t = useT();
  const { academy } = usePersonal();
  const entry = academy[noteKey];
  const [drafts, setDrafts] = useState<Record<AcademyKind, string>>({ reminders: "", plans: "" });
  return (
    <section className="academy-notes" aria-label={t("Akademi notların")}>
      <h2 className="draft__heading">{t("Akademi notların")}</h2>
      <div className="academy__pair">
        {KINDS.map(({ kind, title, placeholder }) => (
          <div key={kind}>
            <h3 className="build__stat">{t(title)}</h3>
            <ul className="academy-notes__list">
              {(entry?.[kind] ?? []).map((text, i) => (
                <li key={text}>
                  <span>{text}</span>
                  <button type="button" className="academy-notes__remove" aria-label={t("Sil")} onClick={() => removeAcademyNote(noteKey, kind, i)}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {(entry?.[kind]?.length ?? 0) < ACADEMY_LIMIT && (
              <form
                className="academy-notes__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!drafts[kind].trim()) return;
                  addAcademyNote(noteKey, kind, drafts[kind]);
                  setDrafts({ ...drafts, [kind]: "" });
                }}
              >
                <input
                  value={drafts[kind]}
                  maxLength={ACADEMY_TEXT_LIMIT}
                  placeholder={t(placeholder)}
                  aria-label={t(title)}
                  onChange={(event) => setDrafts({ ...drafts, [kind]: event.target.value })}
                />
                <Button size="small" type="submit">
                  {t("Ekle")}
                </Button>
              </form>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** The same notes as read-only lines, for champ select where there is no room to edit. */
export function AcademyPreview({ noteKey, label }: { noteKey: string; label: string }) {
  const { academy } = usePersonal();
  const entry = academy[noteKey];
  if (!entry) return null;
  return (
    <ul className="academy-notes__preview" aria-label={label}>
      {[...entry.reminders, ...entry.plans].map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  );
}
