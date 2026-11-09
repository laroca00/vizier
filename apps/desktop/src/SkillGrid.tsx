import { skillSequence } from "./overlay/live";
import { useT } from "./i18n";

const KEYS = ["Q", "W", "E", "R"] as const;

export { skillSequence };

export function SkillGrid({ skills }: { skills: { firstLevels: number[]; maxOrder: number[] } }) {
  const t = useT();
  const sequence = skillSequence(skills);
  return (
    <div className="skillgrid" role="table" aria-label={t("Seviye seviye yetenek sırası")}>
      {KEYS.map((key) => (
        <div key={key} role="row" style={{ display: "contents" }}>
          <span className="skillgrid__key" role="rowheader">
            {key}
          </span>
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} role="cell" data-on={sequence[i] === key || undefined} data-ult={key === "R" || undefined}>
              {sequence[i] === key ? i + 1 : ""}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
