import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "@fontsource-variable/geologica/shrp.css";
import "./styles.css";
import App from "./App";
import { Overlay } from "./overlay/Overlay";

// One bundle serves both windows; the overlay window is told apart by its label.
function isOverlay() {
  if (isTauri()) return getCurrentWindow().label === "overlay";
  return import.meta.env.DEV && ["overlay", "scouting"].includes(new URLSearchParams(location.search).get("fixture") ?? "");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isOverlay() ? <Overlay /> : <App />}
  </React.StrictMode>,
);
