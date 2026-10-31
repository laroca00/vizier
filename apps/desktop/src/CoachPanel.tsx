import { ApiError, getCoaching } from "./api";
import { LiquidGlass } from "./ui/LiquidGlass";
import { useAsync } from "./useAsync";

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 503) return "Maç analizi henüz açılmadı.";
    if (error.status === 403) return "Maç analizi bu hesap için açık değil.";
    if (error.status === 429) return "Bugünkü analiz sınırına ulaşıldı. Yarın tekrar dene.";
    if (error.status === 404) return "Bu maçın verisi bulunamadı.";
  }
  return "Analiz alınamadı. Vizier sunucusuna şu an ulaşılamıyor.";
}

type Props = { matchId: string; puuid: string; championName: string; onClose: () => void };

export function CoachPanel({ matchId, puuid, championName, onClose }: Props) {
  const [state, retry] = useAsync(`${matchId}:${puuid}`, () => getCoaching(matchId, puuid));

  return (
    <LiquidGlass className="panel coach" radius={28} strength={2.5}>
      <header className="coach__header">
        <h2 className="coach__title">{championName} maçının analizi</h2>
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
        </>
      ) : state.status === "error" ? (
        <div role="alert">
          <p className="coach__note">{errorMessage(state.error)}</p>
          <button type="button" className="button" onClick={retry}>
            Tekrar dene
          </button>
        </div>
      ) : (
        <p className="coach__note" aria-live="polite">
          Maç inceleniyor. Bu yarım dakika kadar sürebilir.
        </p>
      )}
    </LiquidGlass>
  );
}
