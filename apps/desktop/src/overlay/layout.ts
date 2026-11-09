import { useEffect, useState } from "react";
import { SCOREBOARD_SPOT, type OverlayMode, type Spot, type WidgetId } from "./registry";

// Where the player dragged each overlay box, as fractions of the screen so a
// resolution change keeps the arrangement. Arrangements are kept per game
// mode and per screen size; boxes never moved sit at their default spot.

export type { Spot, WidgetId };
export type Layout = Partial<Record<WidgetId, Spot>> & {
  /** Distance between scoreboard rows, as a share of the screen height. */
  rowGap?: number;
};

export { SCOREBOARD_SPOT };
export const ROW_GAP = 0.0565;
/** Boxes snap to this many pixels while dragging. */
export const GRID = 8;

export type ScreenSize = { width: number; height: number };

export type LayoutFile = {
  version: 2;
  /** What older versions stored: one arrangement for every mode and size. */
  legacy: Layout;
  layouts: Record<string, Layout>;
};

const KEY = "vizier.overlayLayout";

export const layoutKey = (mode: OverlayMode, size: ScreenSize) => `${mode}:${Math.round(size.width)}x${Math.round(size.height)}`;

/** Reads what any version stored; an older single layout becomes the fallback. */
export function parseLayoutFile(raw: string | null): LayoutFile {
  try {
    const data = JSON.parse(raw ?? "{}") as Partial<LayoutFile> & Layout;
    if (data.version === 2 && data.layouts && typeof data.layouts === "object") {
      return { version: 2, legacy: data.legacy ?? {}, layouts: data.layouts };
    }
    return { version: 2, legacy: data as Layout, layouts: {} };
  } catch {
    return { version: 2, legacy: {}, layouts: {} };
  }
}

/** The arrangement for this mode and screen: exact match, else the older shared one. */
export function pickLayout(file: LayoutFile, mode: OverlayMode, size: ScreenSize): Layout {
  return file.layouts[layoutKey(mode, size)] ?? file.legacy;
}

export function withLayout(file: LayoutFile, mode: OverlayMode, size: ScreenSize, layout: Layout): LayoutFile {
  return { ...file, layouts: { ...file.layouts, [layoutKey(mode, size)]: layout } };
}

export function withoutLayout(file: LayoutFile, mode: OverlayMode, size: ScreenSize): LayoutFile {
  const layouts = { ...file.layouts };
  // An empty entry keeps the shared fallback from coming back after "reset".
  layouts[layoutKey(mode, size)] = {};
  return { ...file, layouts };
}

/** Rounds a spot so the box's top left lands on the pixel grid. */
export function snapSpot(spot: Spot, size: ScreenSize, grid = GRID): Spot {
  const snap = (fraction: number, span: number) => Math.round((Math.round((fraction * span) / grid) * grid) / span * 1e6) / 1e6;
  return { x: snap(spot.x, size.width), y: snap(spot.y, size.height) };
}

function read(): LayoutFile {
  try {
    return parseLayoutFile(localStorage.getItem(KEY));
  } catch {
    return parseLayoutFile(null);
  }
}

function write(file: LayoutFile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(file));
  } catch {
    // The arrangement still holds until the overlay reloads.
  }
}

export function useLayout(mode: OverlayMode, size: ScreenSize) {
  const [file, setFile] = useState(read);
  // A drag in progress is shown before it is saved.
  const [draft, setDraft] = useState<Layout | null>(null);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) setFile(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const saved = pickLayout(file, mode, size);
  return {
    layout: draft ?? saved,
    preview: setDraft,
    save: (next: Layout) => {
      const updated = withLayout(file, mode, size, next);
      setDraft(null);
      setFile(updated);
      write(updated);
    },
    reset: () => {
      const updated = withoutLayout(file, mode, size);
      setDraft(null);
      setFile(updated);
      write(updated);
    },
  };
}
