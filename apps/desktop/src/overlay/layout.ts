import { useEffect, useState } from "react";

// Where the player dragged each overlay box, as fractions of the screen so a
// resolution change keeps the arrangement. Boxes never moved stay in the
// default column at the top left.

export type WidgetId = "skill" | "next" | "timers" | "items" | "augments" | "scoreboard";
export type Spot = { x: number; y: number };
export type Layout = Partial<Record<WidgetId, Spot>> & {
  /** Distance between scoreboard rows, as a share of the screen height. */
  rowGap?: number;
};

// A guess for a 16:9 screen at the default HUD scale; the player lines it up in edit mode.
export const SCOREBOARD_SPOT: Spot = { x: 0.482, y: 0.318 };
export const ROW_GAP = 0.0565;

const KEY = "vizier.overlayLayout";

function read(): Layout {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Layout;
  } catch {
    return {};
  }
}

function write(layout: Layout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(layout));
  } catch {
    // The arrangement still holds until the overlay reloads.
  }
}

export function useLayout(): { layout: Layout; preview: (layout: Layout) => void; save: (layout: Layout) => void; reset: () => void } {
  const [layout, setLayout] = useState(read);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) setLayout(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return {
    layout,
    preview: setLayout,
    save: (next) => {
      setLayout(next);
      write(next);
    },
    reset: () => {
      setLayout({});
      write({});
    },
  };
}
