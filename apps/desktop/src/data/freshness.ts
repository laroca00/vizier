type Translate = (text: string, params?: Record<string, string | number>) => string;

/** "3 saat önce"-style age of a doc, or null when the server did not say. */
export function ageText(t: Translate, updatedAt: number | undefined, now = Date.now()): string | null {
  if (!updatedAt || updatedAt > now) return null;
  const minutes = Math.floor((now - updatedAt) / 60_000);
  if (minutes < 1) return t("az önce güncellendi");
  if (minutes < 60) return t("{n} dakika önce güncellendi", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return t("{n} saat önce güncellendi", { n: hours });
  return t("{n} gün önce güncellendi", { n: Math.floor(hours / 24) });
}
