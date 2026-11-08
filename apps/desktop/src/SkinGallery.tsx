import { useState } from "react";
import { loadingUrl, skinLabel, skins, splashUrl, type Champion } from "./data/ddragon";
import { useT } from "./i18n";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { useAsync } from "./useAsync";
import "./SkinGallery.css";

/** Closed until asked for, so a page visit does not fetch the skin list or any art. */
export function SkinGallery({ champion }: { champion: Champion }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [state] = useAsync(open ? `skins:${champion.id}` : null, () => skins(champion.id));
  const list = state.status === "done" ? state.value : [];
  const previewed = list.find((s) => s.num === preview);

  return (
    <section className="skins" aria-label={t("Görünümler")}>
      <Button variant="ghost" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? t("Görünümleri gizle") : t("Görünümler")}
      </Button>
      {open && state.status === "error" && <p className="build__note">{t("Görünümler alınamadı.")}</p>}
      {open && list.length > 0 && (
        <ul className="skins__grid">
          {list.map((skin) => (
            <li key={skin.num}>
              <button type="button" className="skins__tile" onClick={() => setPreview(skin.num)}>
                <img src={loadingUrl(champion.id, skin.num)} alt="" loading="lazy" width={120} height={218} />
                <span>{skinLabel(skin, champion.name)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!previewed} title={previewed ? skinLabel(previewed, champion.name) : ""} onClose={() => setPreview(null)} wide>
        {previewed && <img className="skins__splash" src={splashUrl(champion.id, previewed.num)} alt={skinLabel(previewed, champion.name)} />}
      </Modal>
    </section>
  );
}
