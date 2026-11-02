import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useT } from "./i18n";

const CHECK_EVERY = 30 * 60_000;
/** Focusing the window checks again, but not more often than this. */
const MIN_GAP = 5 * 60_000;

export function UpdateNotice() {
  const t = useT();
  const [update, setUpdate] = useState<Update | null>(null);
  const [state, setState] = useState<"idle" | "installing" | "failed">("idle");

  // Vizier starts with Windows and lives in the tray for days, so one check at
  // launch would miss every release after it. A failed check (offline, server
  // down) just means no notice until the next one.
  useEffect(() => {
    if (!isTauri() || import.meta.env.DEV) return;
    let lastCheck = 0;
    const run = () => {
      if (Date.now() - lastCheck < MIN_GAP) return;
      lastCheck = Date.now();
      check().then((found) => found && setUpdate(found), () => {});
    };
    run();
    const timer = setInterval(run, CHECK_EVERY);
    window.addEventListener("focus", run);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", run);
    };
  }, []);

  if (!update) return null;

  async function install() {
    setState("installing");
    try {
      await update!.downloadAndInstall();
      await relaunch();
    } catch {
      setState("failed");
    }
  }

  return (
    <div className="update" role="status">
      <span>
        {state === "failed" ? t("Güncelleme indirilemedi.") : t("Vizier {version} hazır.", { version: update.version })}
      </span>
      <button type="button" className="button" disabled={state === "installing"} onClick={install}>
        {state === "installing" ? t("Güncelleniyor") : state === "failed" ? t("Tekrar dene") : t("Güncelle ve yeniden başlat")}
      </button>
    </div>
  );
}
