import { useT } from "../i18n";
import { isFavourite, type FavKind } from "../favourites";
import { toggleFavouriteItem, usePersonal } from "../personal";

/** A star that files the item under the player's favourites; the favourites page lists them. */
export function FavouriteButton({ kind, id, label, championId = null }: { kind: FavKind; id: string; label: string; championId?: number | null }) {
  const t = useT();
  const { favs } = usePersonal();
  const on = isFavourite(favs, kind, id);
  return (
    <button type="button" className="star" aria-pressed={on} onClick={() => toggleFavouriteItem({ kind, id, label, championId })}>
      {on ? t("Favorilerde") : t("Favorilere ekle")}
    </button>
  );
}
