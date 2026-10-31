import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useT } from "./i18n";

export function UpdateNotice() {
  const t = useT();
  const [update, setUpdate] = useState<Update | null>(null);
  const [state, setState] = useState<"idle" | "installing" | "failed">("idle");

  useEffect(() => {
    if (!isTauri() || import.meta.env.DEV) return;
    // A failed check (offline, server down) just means no notice this session.
    check().then(setUpdate, () => setUpdate(null));
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
