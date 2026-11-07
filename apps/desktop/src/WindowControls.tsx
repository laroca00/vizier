import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useT } from "./i18n";

// Glyphs only show while the pointer is over the group, as on macOS.
const GLYPHS = {
  close: "M3.5 3.5l5 5M8.5 3.5l-5 5",
  minimize: "M3 6h6",
  maximize: "M3.6 8.4V3.6h4.8zM8.4 3.6v4.8H3.6z",
  restore: "M6 2.8V6H2.8zM6 9.2V6h3.2z",
};

function Light({ kind, label, glyph, onClick }: { kind: string; label: string; glyph: string; onClick: () => void }) {
  return (
    <button type="button" className="lights__light" data-kind={kind} aria-label={label} title={label} onClick={onClick}>
      <svg viewBox="0 0 12 12" width={12} height={12} aria-hidden="true">
        <path d={glyph} fill={kind === "maximize" ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" />
      </svg>
    </button>
  );
}

/** Close, minimise and maximise as traffic lights, since the window has no
 * system frame. Close keeps Vizier in the tray, same as before. */
export function WindowControls() {
  const t = useT();
  const [maximized, setMaximized] = useState(false);
  const [focused, setFocused] = useState(() => document.hasFocus());

  useEffect(() => {
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    if (!isTauri()) {
      return () => {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("blur", onBlur);
      };
    }
    const current = getCurrentWindow();
    const sync = () => current.isMaximized().then(setMaximized, () => {});
    sync();
    const unlisten = current.onResized(sync);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      unlisten.then((stop) => stop());
    };
  }, []);

  // Outside Tauri (the dev browser) the lights still render, so the layout can be checked.
  const run = (action: (w: ReturnType<typeof getCurrentWindow>) => Promise<void>) => () => {
    if (isTauri()) action(getCurrentWindow()).catch(() => {});
  };

  return (
    <div className="lights" data-blurred={!focused || undefined}>
      <Light kind="close" label={t("Tepsiye kapat")} glyph={GLYPHS.close} onClick={run((w) => w.close())} />
      <Light kind="minimize" label={t("Simge durumuna küçült")} glyph={GLYPHS.minimize} onClick={run((w) => w.minimize())} />
      <Light
        kind="maximize"
        label={t(maximized ? "Önceki boyuta getir" : "Ekranı kapla")}
        glyph={maximized ? GLYPHS.restore : GLYPHS.maximize}
        onClick={run((w) => w.toggleMaximize())}
      />
    </div>
  );
}
