import { useState } from "react";
import type { Picks } from "./api";
import { formatPercent, useLang, useT } from "./i18n";
import { SkillGrid } from "./SkillGrid";

type Option = NonNullable<Picks["skills"]> & { share?: number };

const KEYS = ["", "Q", "W", "E", "R"];

/** The skill order, and when several are common, a pick between them with how often each is played. */
export function SkillOptions({ skills, options }: { skills: NonNullable<Picks["skills"]>; options?: Option[] }) {
  const t = useT();
  const lang = useLang();
  const list = options && options.length >= 2 ? options : null;
  const [chosen, setChosen] = useState(0);
  const current: Option = list ? (list[chosen] ?? list[0]) : skills;
  const first = current.firstLevels.map((s) => KEYS[s]).join(", ");
  const max = current.maxOrder.map((s) => KEYS[s]).join(" > ");
  return (
    <section className="build__block" aria-label={t("Yetenek sırası")}>
      {list && (
        <div className="build__styles" role="group" aria-label={t("Yaygın yetenek sıraları")}>
          {list.map((option, i) => (
            <button key={option.maxOrder.join("") + option.firstLevels.join("")} type="button" className="build__style-tab" aria-pressed={i === chosen} onClick={() => setChosen(i)}>
              <span className="build__style-name">{option.maxOrder.map((s) => KEYS[s]).join(" > ")}</span>
              <span className="build__style-meta">
                {t("{share} oynanma, {rate} kazanma, {games} maç", {
                  share: formatPercent(option.share ?? 0, lang, 0),
                  rate: formatPercent(option.winRate, lang, 1),
                  games: option.games,
                })}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="build__stat">{t("Yetenek sırası: önce {first}, en çok {max}", { first, max })}</p>
      <SkillGrid skills={current} />
    </section>
  );
}
