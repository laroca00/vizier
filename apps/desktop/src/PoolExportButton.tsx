import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { getBuild } from "./api";
import { items } from "./data/ddragon";
import { useT } from "./i18n";
import { fromPicks } from "./library/convert";
import { useLibrary } from "./library/store";
import { usePersonal } from "./personal";
import { itemSetOf, planPoolExport, summarize } from "./poolExport";
import { Button } from "./ui/Button";
import { useToast } from "./ui/Toast";

/** Writes an item set for every champion in the pool into the client. */
export function PoolExportButton() {
  const t = useT();
  const toast = useToast();
  const { pool } = usePersonal();
  const library = useLibrary();
  const [busy, setBusy] = useState(false);
  if (pool.length === 0) return null;

  async function run() {
    setBusy(true);
    const labels = { start: t("Başlangıç"), core: t("Ana eşyalar, bu sırayla"), more: t("Duruma göre") };
    try {
      const catalog = await items();
      const results: ("written" | "skipped" | "failed")[] = [];
      for (const { pick, saved } of planPoolExport(pool, library.builds)) {
        let set;
        if (saved) set = itemSetOf(saved, labels);
        else {
          const build = await getBuild(pick.championId, pick.position).catch(() => null);
          if (build) set = itemSetOf(fromPicks({ name: "Vizier", championId: pick.championId, position: pick.position }, build, (id) => !!catalog.get(id)?.complete), labels);
        }
        if (!set) {
          results.push("skipped");
          continue;
        }
        try {
          await invoke("import_item_set", set);
          results.push("written");
        } catch {
          results.push("failed");
          // The client is not reachable, so the rest would fail the same way.
          break;
        }
      }
      const { written, skipped, failed } = summarize(results);
      if (failed) toast("error", t("Aktarılamadı. League istemcisinin açık olduğundan emin ol."));
      else toast("success", t("{written} eşya seti yazıldı, {skipped} şampiyon için build yok", { written, skipped }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="small" variant="ghost" disabled={busy} onClick={run}>
      {busy ? t("Aktarılıyor…") : t("Havuzu istemciye aktar")}
    </Button>
  );
}
