export type IconName =
  | "home"
  | "queue"
  | "draft"
  | "tiers"
  | "pros"
  | "settings"
  | "about"
  | "search"
  | "sidebar"
  | "chevron"
  | "profile"
  | "refresh"
  | "close"
  | "overlay"
  | "library"
  | "champions";

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
  search: "M8.8 3.5a5.3 5.3 0 1 1 0 10.6 5.3 5.3 0 0 1 0-10.6zM12.7 12.7l3.8 3.8",
  sidebar: "M3.5 4.5h13v11h-13zM8 4.5v11M5.4 7.5h.8M5.4 10h.8",
  chevron: "M8 5.5 12.5 10 8 14.5",
  profile: "M10 3.8a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM4.5 16.2c.8-2.6 3-4 5.5-4s4.7 1.4 5.5 4",
  refresh: "M15.5 10a5.5 5.5 0 1 1-1.6-3.9M15.5 3.8v2.8h-2.8",
  close: "M5.5 5.5l9 9M14.5 5.5l-9 9",
  overlay: "M3.5 4.5h13v9h-13zM7 16.5h6M10 13.5v3M6.5 7.5h3v2.5h-3z",
  champions: "M10 3l6 2.5v4c0 3.6-2.5 6.3-6 7.5-3.5-1.2-6-3.9-6-7.5v-4zM7.5 9.5l2 2 3.5-4",
  library: "M4 3.5h3v13H4zM8.5 3.5h3v13h-3zM13.2 4.3l2.7-.7 2.6 12.3-2.7.6z",
};

export function NavIcon({ name, className = "side__icon", size = 20 }: { name: IconName; className?: string; size?: number }) {
  return (
    <svg className={className} viewBox="0 0 20 20" width={size} height={size} aria-hidden="true">
      <path d={PATHS[name]} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
