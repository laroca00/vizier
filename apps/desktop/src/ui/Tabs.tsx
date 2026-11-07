import { useRef, type KeyboardEvent, type ReactNode } from "react";

export type TabItem<T extends string | number> = { id: T; label: ReactNode; icon?: ReactNode };

type Props<T extends string | number> = {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Names the group for screen readers. */
  label: string;
  size?: "small" | "medium";
  className?: string;
};

/** A segmented row of choices. Arrow keys, Home and End move between them, as the ARIA tabs pattern asks. */
export function Tabs<T extends string | number>({ items, value, onChange, label, size = "medium", className }: Props<T>) {
  const list = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent) {
    const index = items.findIndex((item) => item.id === value);
    const last = items.length - 1;
    const next =
      event.key === "ArrowRight" ? (index + 1) % items.length
      : event.key === "ArrowLeft" ? (index - 1 + items.length) % items.length
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : null;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next].id);
    list.current?.querySelectorAll<HTMLButtonElement>("[role=tab]")[next]?.focus();
  }

  return (
    <div ref={list} className={["tabs", size === "small" && "tabs--small", className].filter(Boolean).join(" ")} role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            className="tabs__tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
