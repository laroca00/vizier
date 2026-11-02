import { nextSkill } from "./overlay/live";
import { useT } from "./i18n";

const KEYS = ["Q", "W", "E", "R"] as const;

/**
 * The full 18-level order, played out with the same rules the overlay uses:
 * the first levels as picked, R whenever it unlocks, then the max order.
 */
export function skillSequence(skills: { firstLevels: number[]; maxOrder: number[] }): (typeof KEYS)[number][] {
  const ranks: [number, number, number, number] = [0, 0, 0, 0];
  const out: (typeof KEYS)[number][] = [];
  for (let level = 1; level <= 18; level++) {
    const key = nextSkill(level, ranks, skills);
    if (!key) break;
    ranks[KEYS.indexOf(key)]++;
    out.push(key);
  }
  return out;
}

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
