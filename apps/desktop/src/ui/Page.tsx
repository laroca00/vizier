import type { ReactNode } from "react";

/** A page heading with an optional subtitle and the controls that filter what's below. */
export function PageHeader({ title, subtitle, toolbar }: { title: string; subtitle?: ReactNode; toolbar?: ReactNode }) {
  return (
    <header className="page__head enter">
      <div>
        <h1 className="page__title">{title}</h1>
        {subtitle && <p className="page__subtitle">{subtitle}</p>}
      </div>
      {toolbar && <div className="page__toolbar">{toolbar}</div>}
    </header>
  );
}
