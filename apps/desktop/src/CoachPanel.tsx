import { useEffect, useState } from "react";
import { ApiError, getCoaching } from "./api";
import type { CoachTarget } from "./ProfileCard";
import { LiquidGlass } from "./ui/LiquidGlass";
import { useAsync } from "./useAsync";

// Riot publishes a match a few minutes after it ends.
const PUBLISH_RETRY_MS = 30_000;
const PUBLISH_RETRIES = 12;

const SOURCES: Record<string, string> = {
  rules: "Vizier'in maç verisinden çıkardığı tespitler",
  "workers-ai": "Vizier'in maç verisinden çıkardığı tespitler",
  claude: "Claude ile yazıldı",
};

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) return "Bugünkü analiz sınırına ulaşıldı. Yarın tekrar dene.";
    if (error.status === 404) return "Bu maçın verisi bulunamadı.";
  }
  return "Analiz alınamadı. Vizier sunucusuna şu an ulaşılamıyor.";
}

export function CoachPanel({ matchId, puuid, championName, justFinished, onClose }: CoachTarget & { onClose: () => void }) {
  const [state, retry] = useAsync(`${matchId}:${puuid}`, () => getCoaching(matchId, puuid));
  const [retries, setRetries] = useState(0);
  const waitingForRiot =
    justFinished && state.status === "error" && state.error instanceof ApiError && state.error.status === 404 && retries < PUBLISH_RETRIES;

  useEffect(() => {
    if (!waitingForRiot) return;
    const timer = setTimeout(() => {
      setRetries((n) => n + 1);
      retry();
    }, PUBLISH_RETRY_MS);
    return () => clearTimeout(timer);
  }, [waitingForRiot, retry]);

  const title = justFinished ? "Son maçının analizi" : `${championName} maçının analizi`;

  return (
    <LiquidGlass className="panel coach" radius={28} strength={2.5}>
      <header className="coach__header">
        <h2 className="coach__title">{title}</h2>
        <button type="button" className="button" onClick={onClose}>
          Geri
        </button>
      </header>

      {state.status === "done" ? (
        <>
          <p className="coach__headline">{state.value.headline}</p>
          <ol className="coach__points">
            {state.value.points.map((point, i) => (
              <li key={i}>
                <p className="coach__point-title">
                  {point.minute !== null && <span className="coach__minute">{Math.floor(point.minute)}. dk</span>}
                  {point.title}
                </p>
                <p className="coach__point-detail">{point.detail}</p>
              </li>
            ))}
          </ol>
          {state.value.source && <p className="coach__source">{SOURCES[state.value.source] ?? ""}</p>}
        </>
      ) : waitingForRiot ? (
        <p className="coach__note" aria-live="polite">
          Riot maçı birkaç dakika içinde yayınlıyor. Vizier hazır olunca analizi kendiliğinden getirecek.
        </p>
      ) : state.status === "error" ? (
        <div role="alert">
          <p className="coach__note">{errorMessage(state.error)}</p>
          <button type="button" className="button" onClick={retry}>
            Tekrar dene
          </button>
        </div>
      ) : (
        <p className="coach__note" aria-live="polite">
          Maç inceleniyor.
        </p>
      )}
    </LiquidGlass>
  );
}
