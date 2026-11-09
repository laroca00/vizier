import { useState } from "react";
import { FAV_KINDS, FAV_KIND_TEXT, allFavouriteTags, filterFavourites, recentlyOpened, type FavKind, type Favourite } from "../favourites";
import { useLang, useT } from "../i18n";
import { addFavCollection, fileFavourite, noteFavouriteOpened, removeFavCollection, tagFavourite, toggleFavouriteItem, usePersonal } from "../personal";
import { Button } from "../ui/Button";
import { SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState } from "../ui/States";
import "../workspace/workspace.css";
import "./FavouritesPage.css";

/** Everything the player starred, with tags and collections. Opening an entry goes to the page it came from. */
export function FavouritesPage({ onOpen }: { onOpen: (favourite: Favourite) => void }) {
  const t = useT();
  const lang = useLang();
  const { favs, favCollections } = usePersonal();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<FavKind | "">("");
  const [collection, setCollection] = useState("");
  const [tag, setTag] = useState("");
  const [newCollection, setNewCollection] = useState("");
  const shown = filterFavourites(favs, { query, kind: kind || null, collection: collection || null, tag: tag || null }, lang);
  const recent = recentlyOpened(favs, 4);
  const tags = allFavouriteTags(favs);

  return (
    <LiquidGlass className="panel tiers favs" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Favoriler")} subtitle={t("Yıldızladığın build, eşleşme, eşya, rün, şablon ve kombolar.")} />
      {favs.length === 0 ? (
        <EmptyState title={t("Henüz favori yok")}>{t("Kombo, build, eşleşme, eşya, rün ve şablonlardaki yıldızla buraya ekle.")}</EmptyState>
      ) : (
        <>
          {recent.length > 0 && (
            <p className="build__stat">
              {t("Son açılanlar")}:{" "}
              {recent.map((f) => (
                <button key={`${f.kind}${f.id}`} type="button" className="workspace__link" onClick={() => { noteFavouriteOpened(f.kind, f.id); onOpen(f); }}>
                  {f.label}{" "}
                </button>
              ))}
            </p>
          )}
          <div className="favs__bar">
            <SearchInput label={t("Favorilerde ara")} value={query} onChange={setQuery} />
            <Select label={t("Tür")} value={kind} onChange={(v) => setKind(v as FavKind | "")} options={[{ value: "", label: t("Hepsi") }, ...FAV_KINDS.map((k) => ({ value: k, label: t(FAV_KIND_TEXT[k]) }))]} />
            <Select label={t("Koleksiyon")} value={collection} onChange={setCollection} options={[{ value: "", label: t("Hepsi") }, ...favCollections.map((c) => ({ value: c, label: c }))]} />
            {tags.length > 0 && <Select label={t("Etiket")} value={tag} onChange={setTag} options={[{ value: "", label: t("Hepsi") }, ...tags.map((x) => ({ value: x, label: x }))]} />}
          </div>
          <form className="favs__bar" onSubmit={(e) => { e.preventDefault(); addFavCollection(newCollection); setNewCollection(""); }}>
            <input value={newCollection} maxLength={30} placeholder={t("Yeni koleksiyon")} aria-label={t("Yeni koleksiyon")} onChange={(e) => setNewCollection(e.target.value)} />
            <Button type="submit" size="small">{t("Ekle")}</Button>
            {favCollections.map((c) => (
              <Button key={c} size="small" variant="ghost" onClick={() => { removeFavCollection(c); if (collection === c) setCollection(""); }}>{t("Koleksiyonu sil: {name}", { name: c })}</Button>
            ))}
          </form>
          {shown.length === 0 ? (
            <p className="build__note">{t("Bu filtreye uyan favori yok.")}</p>
          ) : (
            <ul className="favs__list">
              {shown.map((f) => (
                <li key={`${f.kind}${f.id}`} className="favs__item">
                  <div className="favs__row">
                    <button type="button" className="favs__open" onClick={() => { noteFavouriteOpened(f.kind, f.id); onOpen(f); }}>{f.label}</button>
                    <span className="build__stat">{t(FAV_KIND_TEXT[f.kind])}</span>
                    <Button size="small" variant="ghost" onClick={() => toggleFavouriteItem(f)}>{t("Kaldır")}</Button>
                  </div>
                  <div className="favs__row">
                    {favCollections.length > 0 && (
                      <Select label={t("Koleksiyon")} hideLabel value={f.collection ?? ""} onChange={(v) => fileFavourite(f.kind, f.id, v || null)} options={[{ value: "", label: t("Koleksiyonsuz") }, ...favCollections.map((c) => ({ value: c, label: c }))]} />
                    )}
                    <input
                      defaultValue={f.tags.join(", ")}
                      aria-label={t("Etiketler (virgülle)")}
                      placeholder={t("Etiketler (virgülle)")}
                      onBlur={(e) => tagFavourite(f.kind, f.id, e.target.value.split(","))}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </LiquidGlass>
  );
}
