import type { ReactNode } from "react";
import { useT } from "../i18n";

export type AcademySource = "ddragon" | "crawler" | "editorial";

const SOURCE_TEXT: Record<AcademySource, string> = {
  ddragon: "Data Dragon",
  crawler: "Vizier crawler",
  editorial: "Vizier değerlendirmesi",
};

/** One section of the matchup academy, with where its content comes from. */
export function AcademyBlock({ sources, children }: { sources: AcademySource[]; children: ReactNode }) {
  const t = useT();
  return (
    <div className="academy__block">
      <p className="academy__source" data-editorial={sources.includes("editorial") && sources.length === 1 ? true : undefined}>
        {t("Veri kaynağı")}: {sources.map((s) => t(SOURCE_TEXT[s])).join(", ")}
      </p>
      {children}
    </div>
  );
}
