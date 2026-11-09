import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useT } from "../i18n";
import type { DraftTurn } from "../lcu";
import { hoverChampion, lockChampion } from "../lcuActions";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

/** Hover and ban buttons for a ban suggestion; shown only on the player's own ban turn. */
export function BanButtons({ championId, championName, turn }: { championId: number; championName: string; turn: DraftTurn | null | undefined }) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (turn?.kind !== "ban" || !turn.mine) return null;

  async function run(lock: boolean) {
    setBusy(true);
    try {
      await (lock ? lockChampion : hoverChampion)("ban", championId);
    } catch {
      toast("error", t("{champion} yasaklanamadı. İstemciden elle yasakla.", { champion: championName }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="lock-buttons">
      <Button size="small" disabled={!isTauri()} busy={busy} aria-label={t("{champion} üzerine getir", { champion: championName })} onClick={() => run(false)}>
        {t("Seç")}
      </Button>
      <Button size="small" variant="primary" disabled={!isTauri()} busy={busy} aria-label={t("{champion} yasakla", { champion: championName })} onClick={() => run(true)}>
        {t("Yasakla")}
      </Button>
    </span>
  );
}
