import { invoke } from "@tauri-apps/api/core";
import { useState } from "react";
import { useT } from "../i18n";
import { useToast } from "../ui/Toast";
import { runesComplete, toClient } from "./convert";
import type { SavedBuild } from "./store";

type Page = { id: number; name: string };

/**
 * Sends a saved build to the client: rune page, item set and, during champ
 * select, summoner spells. With no free rune page it lists the player's
 * pages so they choose which one to replace.
 */
export function useBuildExport(build: SavedBuild) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<Page[] | null>(null);

  async function exportToClient(replacePageId: number | null = null) {
    const client = toClient(build, { start: t("Başlangıç"), core: t("Ana eşyalar, bu sırayla"), more: t("Duruma göre") });
    setBusy(true);
    setPages(null);
    const done: string[] = [];
    try {
      if (runesComplete(build.runes)) {
        const result = await invoke<{ status: "imported" } | { status: "needsSlot"; pages: Page[] }>("import_runes", { page: client.page, replacePageId });
        if (result.status === "needsSlot") setPages(result.pages);
        else done.push(t("rünler"));
      }
      if (client.itemSet.blocks.length) {
        await invoke("import_item_set", client.itemSet);
        done.push(t("eşya seti"));
      }
      // The client only takes summoner spells during champ select; outside it this fails and that's fine.
      await invoke("import_spells", { spells: client.spells }).then(
        () => done.push(t("büyüler")),
        () => {},
      );
      if (done.length) toast("success", t("Aktarıldı: {parts}", { parts: done.join(", ") }));
    } catch {
      toast("error", t("Aktarılamadı. League istemcisinin açık olduğundan emin ol."));
    } finally {
      setBusy(false);
    }
  }

  return { busy, pages, exportToClient, cancel: () => setPages(null) };
}
