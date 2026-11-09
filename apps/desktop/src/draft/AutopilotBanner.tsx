import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { describeStep, nextStep, type Step } from "../autopilot";
import type { Champion } from "../data/ddragon";
import { useT } from "../i18n";
import type { ChampSelect } from "../lcu";
import { availableChampions, hoverChampion, lockChampion } from "../lcuActions";
import { usePersonal } from "../personal";
import { useSettings } from "../settings";
import { Button } from "../ui/Button";
import "./AutopilotBanner.css";

const RETRY_MS = 1500;
const MAX_TRIES = 3;

/** Sends the pick plan's next step on the player's turn and says what it will do. */
export function AutopilotBanner({ draft, seconds, champions }: { draft: ChampSelect; seconds: number; champions: Map<number, Champion> }) {
  const t = useT();
  const { autopilot, autopilotLockSeconds } = useSettings();
  const { plan } = usePersonal();
  const me = draft.myTeam.find((m) => m.isLocal);
  const rolePlan = me?.position ? plan[me.position.toUpperCase()] : undefined;
  const [cancelled, setCancelled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [allowed, setAllowed] = useState<{ kind: string; ids: Set<number> } | null>(null);
  const sent = useRef({ key: "", tries: 0, at: 0 });

  const turnKind = draft.turn?.mine ? draft.turn.kind : null;
  useEffect(() => {
    sent.current = { key: "", tries: 0, at: 0 };
    setFailed(false);
    if (!turnKind || !isTauri()) return;
    let current = true;
    availableChampions(turnKind)
      .then((ids) => current && setAllowed({ kind: turnKind, ids: new Set(ids) }))
      .catch(() => current && setAllowed(null));
    return () => {
      current = false;
    };
  }, [turnKind]);

  const step: Step | null = nextStep({
    draft,
    plan: rolePlan,
    mode: autopilot,
    lockSeconds: autopilotLockSeconds,
    secondsLeft: seconds,
    allowed: allowed && allowed.kind === turnKind ? allowed.ids : null,
  });

  const key = step ? `${step.kind}:${step.championId}:${step.lock}` : "";
  useEffect(() => {
    if (!step || cancelled || !isTauri()) return;
    const now = Date.now();
    const last = sent.current;
    if (last.key === key && (last.tries >= MAX_TRIES || now - last.at < RETRY_MS)) return;
    sent.current = { key, tries: last.key === key ? last.tries + 1 : 1, at: now };
    (step.lock ? lockChampion : hoverChampion)(step.kind, step.championId)
      .then(() => setFailed(false))
      .catch(() => setFailed(sent.current.tries >= MAX_TRIES));
    // `step` is derived from the other inputs, and `key` stands for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, cancelled, seconds]);

  if (autopilot === "off" || !rolePlan) return null;
  const kind = draft.turn?.kind ?? "pick";
  const list = kind === "ban" ? rolePlan.bans : rolePlan.picks;
  const preview = nextStep({
    draft: { ...draft, turn: { kind, mine: true } },
    plan: rolePlan,
    mode: autopilot,
    lockSeconds: autopilotLockSeconds,
    secondsLeft: Infinity,
    allowed: null,
  });
  if (list.length === 0 || (kind === "pick" && me && me.championId !== 0)) return null;

  const name = preview ? (champions.get(preview.championId)?.name ?? "") : "";
  const how = describeStep(autopilot, autopilotLockSeconds);
  const text = cancelled
    ? t("Bu oyun için otomatik seçim iptal edildi.")
    : !preview
      ? t("Planındaki şampiyonların hiçbiri uygun değil.")
      : kind === "ban"
        ? how === "hover"
          ? t("Sıran gelince {champion} yasak için işaretlenecek", { champion: name })
          : t("Sıran gelince {champion} yasaklanacak", { champion: name })
        : how === "hover"
          ? t("Sıran gelince {champion} üzerine getirilecek", { champion: name })
          : how === "lockNow"
            ? t("Sıran gelince {champion} kilitlenecek", { champion: name })
            : t("{champion}, süre bitmeden {seconds} sn önce kilitlenecek", { champion: name, seconds: autopilotLockSeconds });

  return (
    <div className="autopilot" role="status" data-failed={failed || undefined}>
      <span className="autopilot__text">{failed ? t("Plan uygulanamadı. Elle seç.") : text}</span>
      <Button size="small" variant="ghost" onClick={() => setCancelled((c) => !c)}>
        {cancelled ? t("Yeniden aç") : t("Bu oyun için iptal et")}
      </Button>
    </div>
  );
}
