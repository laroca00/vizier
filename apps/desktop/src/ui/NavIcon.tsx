export type IconName = "home" | "queue" | "draft" | "tiers" | "pros" | "settings" | "about";

// Drawn for Vizier on a 20px grid with a 1.6 stroke, so they sit with the
// Geologica text at the same weight.
const PATHS: Record<IconName, string> = {
  home: "M3 4h6v6H3zM11 4h6v3h-6zM11 9h6v7h-6zM3 12h6v4H3z",
  queue: "M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM10 6.5V10l2.5 1.6",
  draft: "M4 15.5 10 3.5l6 12M6.6 10.5h6.8",
  tiers: "M4 5h12M4 10h8M4 15h4",
  pros: "M10 3.2l2 4.1 4.5.6-3.3 3.1.8 4.5L10 13.4l-4 2.1.8-4.5-3.3-3.1 4.5-.6z",
  settings: "M10 7a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM10 2.8v2M10 15.2v2M2.8 10h2M15.2 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4",
  about: "M10 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM10 9v4.5M10 6.4v.1",
};

export function NavIcon({ name }: { name: IconName }) {
  return (
    <svg className="side__icon" viewBox="0 0 20 20" width={20} height={20} aria-hidden="true">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
