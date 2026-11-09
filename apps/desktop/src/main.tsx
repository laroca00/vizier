import React from "react";
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
import App from "./App";
import { Overlay } from "./overlay/Overlay";
import { OVERLAY_FIXTURES } from "./dev/fixtures";

// One bundle serves both windows; the overlay window is told apart by its label.
function isOverlay() {
  if (isTauri()) return getCurrentWindow().label === "overlay";
  return import.meta.env.DEV && [...Object.keys(OVERLAY_FIXTURES), "scouting"].includes(new URLSearchParams(location.search).get("fixture") ?? "");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isOverlay() ? <Overlay /> : <App />}
  </React.StrictMode>,
);
