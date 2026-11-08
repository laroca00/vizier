import { useCallback, useEffect, useState } from "react";
import type { TierView } from "./pages/tierSort";

// The app has no URLs, so navigation is a typed route and a history stack.
// Mouse back and forward buttons and Alt+Left and Alt+Right walk the stack.

export type Route =
  | { page: "home" }
  | { page: "draft" }
  | { page: "tiers"; view?: TierView }
  | { page: "pros" }
  | { page: "builds" }
  | { page: "champions" }
  | { page: "simulator" }
  | { page: "patches" }
  | { page: "quiz" }
  | { page: "augments" }
  | { page: "matchup"; championId: number | null; opponentId: number | null; position: string }
  | { page: "champion"; championId: number; position: string | null; queue: number }
  | { page: "journal" }
  | { page: "items" }
  | { page: "overlay" }
  | { page: "settings" }
  | { page: "about" };

export type Page = Route["page"];

/** The route a menu entry opens; pages that carry choices start empty. */
export function pageRoute(page: Page): Route {
  if (page === "matchup") return { page, championId: null, opponentId: null, position: "MIDDLE" };
  if (page === "champion") return { page, championId: 0, position: null, queue: 420 };
  return { page };
}

const MAX_HISTORY = 50;

const sameRoute = (a: Route, b: Route) => JSON.stringify(a) === JSON.stringify(b);

export function useNavigation(initial: Route) {
  const [state, setState] = useState({ stack: [initial], index: 0 });
  const route = state.stack[state.index];

  const navigate = useCallback((next: Route) => {
    setState(({ stack, index }) => {
      if (sameRoute(stack[index], next)) return { stack, index };
      const kept = [...stack.slice(0, index + 1), next].slice(-MAX_HISTORY);
      return { stack: kept, index: kept.length - 1 };
    });
  }, []);

  /** Swaps the current entry without adding one, for moves the app makes on its own (champ select ending, say). */
  const replace = useCallback((next: Route) => {
    setState(({ stack, index }) => ({ stack: stack.map((r, i) => (i === index ? next : r)), index }));
  }, []);

  const go = useCallback((step: -1 | 1) => {
    setState(({ stack, index }) => ({ stack, index: Math.min(stack.length - 1, Math.max(0, index + step)) }));
  }, []);

  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      if (event.button === 3) go(-1);
      if (event.button === 4) go(1);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) return;
      event.preventDefault();
      go(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [go]);

  return {
    route,
    navigate,
    replace,
    back: () => go(-1),
    forward: () => go(1),
    canGoBack: state.index > 0,
    canGoForward: state.index < state.stack.length - 1,
  };
}
