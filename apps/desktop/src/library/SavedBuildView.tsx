import { invoke, isTauri } from "@tauri-apps/api/core";
import { useState } from "react";
import { championIconUrl, itemIconUrl, runeIconUrl, spellIconUrl } from "../data/ddragon";
import { useT } from "../i18n";
import { positionLabel } from "../labels";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { runesComplete, toClient } from "./convert";
import { skillOrderLabel, type LibraryData } from "./data";
import { shardName } from "./RuneEditor";
import { deleteBuild, duplicateBuild, toggleFavourite, type SavedBuild } from "./store";

const SOURCES: Record<SavedBuild["source"], string> = {
  stats: "Vizier istatistiklerinden",
  pro: "Bir pro maçından",
  custom: "Sıfırdan",
};

type Props = { build: SavedBuild; data: LibraryData; onEdit: () => void; onSelect: (id: string | null) => void };

/** One saved build in full: runes, spells, items, skill order and notes, with its actions. */
export function SavedBuildView({ build, data, onEdit, onSelect }: Props) {
  const t = useT();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pages, setPages] = useState<{ id: number; name: string }[] | null>(null);
  const champion = data.champions.get(build.championId);
  const primary = data.styles.get(build.runes.primaryStyle);
  const secondary = data.styles.get(build.runes.subStyle);
  const [keystone, ...rest] = build.runes.perks;

  async function exportToClient(replacePageId: number | null = null) {
    const client = toClient(build, { start: t("Başlangıç"), core: t("Ana eşyalar, bu sırayla"), more: t("Duruma göre") });
    setBusy(true);
    setPages(null);
    const done: string[] = [];
    try {
      if (runesComplete(build.runes)) {
        const result = await invoke<{ status: "imported" } | { status: "needsSlot"; pages: { id: number; name: string }[] }>("import_runes", {
          page: client.page,
          replacePageId,
        });
        if (result.status === "needsSlot") setPages(result.pages);
        else done.push(t("rünler"));
      }
      if (client.itemSet.blocks.length) {
        await invoke("import_item_set", client.itemSet);
        done.push(t("eşya seti"));
      }
      // The client only takes summoner spells during champ select; outside it this fails and that's fine.
      await invoke("import_spells", { spells: client.spells }).then(
        () => done.push(t("büyüler")),
        () => {},
      );
      if (done.length) toast("success", t("Aktarıldı: {parts}", { parts: done.join(", ") }));
    } catch {
      toast("error", t("Aktarılamadı. League istemcisinin açık olduğundan emin ol."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="saved" aria-label={build.name}>
      <header className="saved__head">
        {champion && <img src={championIconUrl(data.version, champion.id)} alt="" width={56} height={56} />}
        <div>
          <h2 className="saved__name">{build.name}</h2>
          <p className="build__note">
            {[champion?.name, build.position ? positionLabel(build.position) : t("Her rol"), t(SOURCES[build.source])].filter(Boolean).join(", ")}
          </p>
        </div>
        <button
          type="button"
          className="saved__star"
          aria-pressed={build.favourite}
          aria-label={build.favourite ? t("Favorilerden çıkar") : t("Favorilere ekle")}
          title={build.favourite ? t("Favorilerden çıkar") : t("Favorilere ekle")}
          onClick={() => toggleFavourite(build.id)}
        >
          <svg viewBox="0 0 20 20" width={20} height={20} aria-hidden="true">
            <path d="M10 3.2l2 4.1 4.5.6-3.3 3.1.8 4.5L10 13.4l-4 2.1.8-4.5-3.3-3.1 4.5-.6z" />
          </svg>
        </button>
      </header>

      <div className="saved__actions">
        <Button variant="primary" busy={busy} disabled={!isTauri()} onClick={() => exportToClient()}>
          {t("İstemciye aktar")}
        </Button>
        <Button onClick={onEdit}>{t("Düzenle")}</Button>
        <Button onClick={() => onSelect(duplicateBuild(build.id, (name) => t("{name} kopyası", { name }))?.id ?? null)}>{t("Kopyala")}</Button>
        <Button variant="ghost" onClick={() => setConfirming(true)}>
          {t("Sil")}
        </Button>
      </div>

      {pages && (
        <div className="build__choose" role="group" aria-label={t("Üzerine yazılacak rün sayfası")}>
          <p className="build__note">{t("Boş rün sayfası yok. Seçtiğin sayfadaki rünler silinip yerine bu sayfa yazılır.")}</p>
          <div className="build__pages">
            {pages.map((p) => (
              <Button key={p.id} onClick={() => exportToClient(p.id)}>
                {t("{page} yerine yaz", { page: p.name })}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => setPages(null)}>
              {t("Vazgeç")}
            </Button>
          </div>
        </div>
      )}

      <section className="saved__runes" aria-label={t("Rünler")}>
        <div>
          <p className="build__stat">{primary?.name}</p>
          <div className="build__runes">
            {[keystone, ...rest.slice(0, 3)].map((id, i) => {
              const rune = data.runes.get(id);
              return rune ? <img key={id} src={runeIconUrl(rune.icon)} alt={rune.name} title={rune.name} width={i === 0 ? 40 : 28} height={i === 0 ? 40 : 28} /> : null;
            })}
          </div>
        </div>
        <div>
          <p className="build__stat">{secondary?.name}</p>
          <div className="build__runes">
            {rest.slice(3, 5).map((id) => {
              const rune = data.runes.get(id);
              return rune ? <img key={id} src={runeIconUrl(rune.icon)} alt={rune.name} title={rune.name} width={26} height={26} /> : null;
            })}
          </div>
        </div>
        <ul className="saved__shards">
          {build.runes.perks.slice(6, 9).map((id, row) => (
            <li key={row}>{t(shardName(row, id))}</li>
          ))}
        </ul>
      </section>

      <section className="saved__grid">
        <div>
          <p className="build__stat">{t("Büyüler")}</p>
          <div className="build__row">
            {build.spells.map((id, i) => {
              const spell = data.spells.get(id);
              return spell ? <img key={i} src={spellIconUrl(data.version, spell.id)} alt={spell.name} title={spell.name} width={30} height={30} /> : null;
            })}
          </div>
        </div>
        <div>
          <p className="build__stat">{t("Yetenek sırası")}</p>
          <p className="saved__skills">{skillOrderLabel(build.skillOrder)}</p>
        </div>
      </section>

      {[
        { label: "Başlangıç", ids: build.startItems },
        { label: "Ana eşyalar", ids: build.coreItems },
        { label: "Duruma göre", ids: build.items },
      ]
        .filter((row) => row.ids.length > 0)
        .map((row) => (
          <div className="build__row" key={row.label}>
            <span className="build__stat build__row-label">{t(row.label)}</span>
            {row.ids.map((id, i) => {
              const item = data.items.get(id);
              return <img key={`${id}-${i}`} src={itemIconUrl(data.version, id)} alt={item?.name ?? ""} title={item?.name} width={30} height={30} />;
            })}
          </div>
        ))}

      {build.notes && <p className="saved__notes">{build.notes}</p>}
      {build.collections.length > 0 && (
        <ul className="saved__collections">
          {build.collections.map((c) => (
            <li key={c}>{t(c)}</li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirming}
        title={t("Build silinsin mi?")}
        message={t("{name} bu bilgisayardan silinir. Bu geri alınamaz.", { name: build.name })}
        confirmLabel={t("Sil")}
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          deleteBuild(build.id);
          onSelect(null);
          toast("info", t("{name} silindi", { name: build.name }));
        }}
      />
    </article>
  );
}
