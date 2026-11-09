import type { WidgetContext } from "./context";

export function SkillWidget({ t, skill }: WidgetContext) {
  if (!skill) return null;
  return (
    <section className="overlay__card overlay__skill">
      <span className="overlay__key">{skill}</span>
      <span>{t("yükselt")}</span>
    </section>
  );
}
