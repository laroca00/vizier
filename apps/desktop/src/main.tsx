import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fontsource-variable/geologica/shrp.css";
import "./styles.css";
import "./ui/ui.css";
// Shared styles load before any page's own, so a page can override them.
import "./App.css";
import "./pages.css";
import "./shell.css";
import { backupIfDue } from "./backups";
import { OVERLAY_FIXTURES } from "./dev/fixtures";

// Each window loads only its own code: the overlay runs beside the game and
// has no use for the pages, and the main window never draws the overlay.
const App = lazy(() => import("./App"));
const Overlay = lazy(() => import("./overlay/Overlay").then((m) => ({ default: m.Overlay })));

// One bundle serves both windows; the overlay window is told apart by its label.
function isOverlay() {
  if (isTauri()) return getCurrentWindow().label === "overlay";
  return import.meta.env.DEV && [...Object.keys(OVERLAY_FIXTURES), "scouting"].includes(new URLSearchParams(location.search).get("fixture") ?? "");
}

// The main window makes the weekly copy of local data; the overlay window leaves it alone.
if (!isOverlay()) backupIfDue();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Suspense fallback={null}>{isOverlay() ? <Overlay /> : <App />}</Suspense>
  </React.StrictMode>,
);
