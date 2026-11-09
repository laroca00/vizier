import type { ReactNode } from "react";
import { RankPicker } from "../rank/RankPicker";

/**
 * A page heading with an optional subtitle and the controls that filter what's below.
 * `rank` adds the rank bracket picker, on pages that show crawler stats.
 */
export function PageHeader({ title, subtitle, toolbar, rank = false }: { title: string; subtitle?: ReactNode; toolbar?: ReactNode; rank?: boolean }) {
  return (
    <header className="page__head enter">
      <div>
        <h1 className="page__title">{title}</h1>
        {subtitle && <p className="page__subtitle">{subtitle}</p>}
      </div>
      {(toolbar || rank) && (
        <div className="page__toolbar">
          {rank && <RankPicker />}
          {toolbar}
        </div>
      )}
    </header>
  );
}
