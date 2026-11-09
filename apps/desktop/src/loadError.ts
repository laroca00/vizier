import { ApiError } from "./http";

/** Why a load failed, in words a player can act on. Offline wins over everything else. */
export function loadErrorMessage(error: unknown, online: boolean): string {
  if (!online) return "Çevrimdışısın. Bağlantı gelince tekrar dene.";
  if (error instanceof ApiError && error.status >= 500) return "Vizier sunucusu şu an yanıt vermiyor. Biraz sonra tekrar dene.";
  if (error instanceof ApiError && error.status === 429) return "Çok fazla istek gitti. Biraz bekleyip tekrar dene.";
  return "Veri alınamadı. Tekrar dene.";
}
