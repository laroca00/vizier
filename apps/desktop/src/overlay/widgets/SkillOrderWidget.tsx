import type { WidgetContext } from "./context";

export function SkillOrderWidget({ t, skillOrder }: WidgetContext) {
  return (
    <section className="overlay__card" aria-label={t("Yetenek sırası")}>
      <ol className="overlay__skillstrip">
        {skillOrder.keys.map((key, i) => (
          <li key={i} data-done={i < skillOrder.ranked || undefined} data-ult={key === "R" || undefined}>
            <span className="overlay__skilllevel">{i + 1}</span>
            {key}
          </li>
        ))}
      </ol>
    </section>
  );
}
