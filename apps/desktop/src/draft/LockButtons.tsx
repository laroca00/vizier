import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { useT } from "../i18n";
import type { DraftTurn } from "../lcu";
import { hoverChampion, lockChampion } from "../lcuActions";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { lockState } from "./lockState";

type Props = { championId: number; championName: string; turn: DraftTurn | null | undefined; gone: ReadonlySet<number> };

/** "Seç" hovers the champion, "Kilitle" confirms it; both wait for the player's pick turn. */
export function LockButtons({ championId, championName, turn, gone }: Props) {
  const t = useT();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const state = lockState(turn, championId, gone);
  const reason = state.enabled
    ? undefined
    : state.reason === "turn"
      ? t("Sıra sende değil")
      : state.reason === "ban"
        ? t("Şu an yasak sırası")
        : t("Bu şampiyon alınamaz");
  const off = !state.enabled || !isTauri();

  async function run(lock: boolean) {
    setBusy(true);
    try {
      await (lock ? lockChampion : hoverChampion)("pick", championId);
    } catch {
      toast("error", t("{champion} seçilemedi. İstemciden elle seç.", { champion: championName }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="lock-buttons" title={reason}>
      <Button size="small" disabled={off} busy={busy} aria-label={t("{champion} üzerine getir", { champion: championName })} onClick={() => run(false)}>
        {t("Seç")}
      </Button>
      <Button size="small" variant="primary" disabled={off} busy={busy} aria-label={t("{champion} kilitle", { champion: championName })} onClick={() => run(true)}>
        {t("Kilitle")}
      </Button>
    </span>
  );
}
