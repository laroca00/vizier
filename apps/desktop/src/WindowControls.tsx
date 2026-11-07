import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useT } from "./i18n";

// Drawn on the same 20px grid as the nav icons, but at a 1.2 stroke: these
// sit at the window's edge and should read lighter than the menu.
const GLYPHS = {
  minimize: "M5 10h10",
  maximize: "M5.5 5.5h9v9h-9z",
  restore: "M5.5 7.5h7v7h-7zM7.5 7.5V5.5h7v7h-2",
  close: "M5.5 5.5l9 9M14.5 5.5l-9 9",
};

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Minimise, maximise and close, drawn by the app since the window has no
 * system frame. Close keeps Vizier in the tray, same as before. */
export function WindowControls() {
  const t = useT();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    const sync = () => window.isMaximized().then(setMaximized, () => {});
    sync();
    const unlisten = window.onResized(sync);
    return () => {
      unlisten.then((stop) => stop());
    };
  }, []);

  if (!isTauri()) return null;
  const window = getCurrentWindow();

  return (
    <div className="window">
      <button type="button" className="window__button" aria-label={t("Simge durumuna küçült")} title={t("Simge durumuna küçült")} onClick={() => window.minimize()}>
        <Glyph d={GLYPHS.minimize} />
      </button>
      <button
        type="button"
        className="window__button"
        aria-label={t(maximized ? "Önceki boyuta getir" : "Ekranı kapla")}
        title={t(maximized ? "Önceki boyuta getir" : "Ekranı kapla")}
        onClick={() => window.toggleMaximize()}
      >
        <Glyph d={maximized ? GLYPHS.restore : GLYPHS.maximize} />
      </button>
      <button type="button" className="window__button window__button--close" aria-label={t("Kapat")} title={t("Tepsiye kapat")} onClick={() => window.close()}>
        <Glyph d={GLYPHS.close} />
      </button>
    </div>
  );
}
