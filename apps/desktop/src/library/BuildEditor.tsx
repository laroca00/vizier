import { useEffect, useState } from "react";
import { useToast } from "../ui/Toast";
import { getBuild } from "../api";
import { itemIconUrl } from "../data/ddragon";
import { STAT_PRICES } from "../data/itemGold";
import { filterItems, NO_FILTER, offeredStats } from "../itemExplorer";
import { useT } from "../i18n";
import { POSITIONS } from "../labels";
import { Button } from "../ui/Button";
import { FilterChips, SearchInput, Select } from "../ui/Fields";
import { Modal } from "../ui/Modal";
import { duplicateItems, moveItem, runeIssues, type RuneIssue } from "./buildEdit";
import { fromPicks, runesComplete } from "./convert";
import { RIFT_SPELLS, SKILL_ORDERS, skillOrderLabel, type LibraryData } from "./data";
import { RuneEditor } from "./RuneEditor";
import type { SavedBuild } from "./store";

type ItemList = "startItems" | "coreItems" | "items";

const LISTS: { id: ItemList; label: string; max: number }[] = [
  { id: "startItems", label: "Başlangıç", max: 4 },
  { id: "coreItems", label: "Ana eşyalar", max: 4 },
  { id: "items", label: "Duruma göre", max: 6 },
];

const ANY = "ANY";

const RUNE_ISSUES: Record<RuneIssue, string> = {
  "same-tree": "Ana ve ikincil ağaç aynı olamaz.",
  primary: "Ana ağaçta her sıradan bir rün seçilmeli.",
  secondary: "İkincil ağaçtan iki rün seçilmeli.",
  "secondary-rows": "İkincil ağaçtaki iki rün farklı sıralardan olmalı.",
  shards: "Üç bonus da seçilmeli.",
  "wrong-tree": "Bir rün seçili ağaca ait değil.",
};

type Props = {
  build: SavedBuild | null;
  data: LibraryData;
  collections: string[];
  onSave: (build: SavedBuild) => void;
  onClose: () => void;
};

/** Edits every part of a saved build; nothing is stored until Save. */
export function BuildEditor({ build, data, collections, onSave, onClose }: Props) {
  const t = useT();
  const [draft, setDraft] = useState<SavedBuild | null>(build);
  const [list, setList] = useState<ItemList>("coreItems");
  const [query, setQuery] = useState("");
  const [stat, setStat] = useState("");
  const [dragging, setDragging] = useState<{ list: ItemList; index: number } | null>(null);
  const toast = useToast();
  useEffect(() => setDraft(build), [build]);
  if (!draft) return <Modal open={false} title="" onClose={onClose}>{null}</Modal>;

  const set = (patch: Partial<SavedBuild>) => setDraft({ ...draft, ...patch });
  const championOptions = [...data.champions.values()].sort((a, b) => a.name.localeCompare(b.name, "tr")).map((c) => ({ value: String(c.key), label: c.name }));
  const spellOptions = RIFT_SPELLS.map((id) => ({ value: String(id), label: data.spells.get(id)?.name ?? String(id) }));
  const needle = query.trim().toLocaleLowerCase("tr");
  const buyable = [...data.details.values()].filter((i) => i.gold.total > 0 && i.gold.purchasable);
  const found = needle || stat ? filterItems(buyable, { ...NO_FILTER, query, stat: stat || null }, "tr").sort((a, b) => a.gold.total - b.gold.total).slice(0, 12) : [];
  const statOptions = offeredStats(buyable);
  const repeated = duplicateItems(draft);
  const issues = runeIssues(draft.runes, data.styles);
  const current = LISTS.find((l) => l.id === list)!;
  const valid = draft.name.trim().length > 0 && runesComplete(draft.runes);

  async function copyRecommended(part: "runes" | "items") {
    const build = await getBuild(draft!.championId, draft!.position).catch(() => null);
    if (!build) {
      toast("error", t("Bu şampiyon için önerilen build bulunamadı."));
      return;
    }
    const copy = fromPicks({ name: draft!.name, championId: draft!.championId, position: draft!.position }, build, (id) => !!data.items.get(id)?.complete);
    set(part === "runes" ? { runes: copy.runes } : { startItems: copy.startItems, coreItems: copy.coreItems, items: copy.items });
  }

  function addItem(id: number) {
    const items = draft![list];
    if (items.length >= current.max) return;
    set({ [list]: [...items, id] } as Partial<SavedBuild>);
  }

  return (
    <Modal
      open
      wide
      title={t("Build'i düzenle")}
      onClose={onClose}
      actions={
        <>
          {!runesComplete(draft.runes) && <span className="editor__hint">{t("Rün sayfasında boş yer var.")}</span>}
          <Button variant="ghost" onClick={onClose}>
            {t("Vazgeç")}
          </Button>
          <Button variant="primary" disabled={!valid} onClick={() => onSave({ ...draft, name: draft.name.trim() })}>
            {t("Kaydet")}
          </Button>
        </>
      }
    >
      <div className="editor">
        <div className="editor__grid">
          <label className="field">
            <span className="field__label">{t("Ad")}</span>
            <input className="text-input" value={draft.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} />
          </label>
          <Select label={t("Şampiyon")} value={String(draft.championId)} options={championOptions} onChange={(v) => set({ championId: Number(v) })} />
          <Select
            label={t("Rol")}
            value={draft.position ?? ANY}
            options={[{ value: ANY, label: t("Her rol") }, ...Object.entries(POSITIONS).map(([value, label]) => ({ value, label: t(label) }))]}
            onChange={(v) => set({ position: v === ANY ? null : v })}
          />
          <Select label={t("1. büyü")} value={String(draft.spells[0])} options={spellOptions} onChange={(v) => set({ spells: [Number(v), draft.spells[1]] })} />
          <Select label={t("2. büyü")} value={String(draft.spells[1])} options={spellOptions} onChange={(v) => set({ spells: [draft.spells[0], Number(v)] })} />
          <Select
            label={t("Yetenek sırası")}
            value={draft.skillOrder.join("")}
            options={SKILL_ORDERS.map((o) => ({ value: o.join(""), label: skillOrderLabel(o) }))}
            onChange={(v) => set({ skillOrder: v.split("").map(Number) })}
          />
        </div>

        <RuneEditor value={draft.runes} styles={data.styles} onChange={(runes) => set({ runes })} />
        {issues.length > 0 && (
          <ul className="editor__hint editor__issues" role="status">
            {issues.map((issue) => (
              <li key={issue}>{t(RUNE_ISSUES[issue])}</li>
            ))}
          </ul>
        )}
        <div>
          <Button size="small" variant="ghost" onClick={() => copyRecommended("runes")}>
            {t("Rünleri önerilenden kopyala")}
          </Button>
          <Button size="small" variant="ghost" onClick={() => copyRecommended("items")}>
            {t("Eşyaları önerilenden kopyala")}
          </Button>
        </div>

        <section className="editor__items" aria-label={t("Eşyalar")}>
          {LISTS.map((l) => (
            <div key={l.id} className="editor__item-list" data-active={l.id === list || undefined}>
              <button type="button" className="editor__list-name" aria-pressed={l.id === list} onClick={() => setList(l.id)}>
                {t(l.label)}
              </button>
              <ul>
                {draft[l.id].map((id, i) => (
                  <li
                    key={`${id}-${i}`}
                    draggable
                    data-repeated={(l.id !== "startItems" && repeated.includes(id)) || undefined}
                    onDragStart={() => setDragging({ list: l.id, index: i })}
                    onDragOver={(e) => dragging?.list === l.id && e.preventDefault()}
                    onDrop={() => {
                      if (dragging?.list === l.id) set({ [l.id]: moveItem(draft[l.id], dragging.index, i) } as Partial<SavedBuild>);
                      setDragging(null);
                    }}
                    onDragEnd={() => setDragging(null)}
                  >
                    <button
                      type="button"
                      onKeyDown={(e) => {
                        if (!e.altKey || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
                        e.preventDefault();
                        set({ [l.id]: moveItem(draft[l.id], i, i + (e.key === "ArrowLeft" ? -1 : 1)) } as Partial<SavedBuild>);
                      }}
                      title={t("{item} kaldır", { item: data.items.get(id)?.name ?? "" })}
                      aria-label={t("{item} kaldır", { item: data.items.get(id)?.name ?? "" })}
                      onClick={() => set({ [l.id]: draft[l.id].filter((_, j) => j !== i) } as Partial<SavedBuild>)}
                    >
                      <img src={itemIconUrl(data.version, id)} alt="" width={30} height={30} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="editor__hint">{t("Sıralamayı değiştirmek için eşyayı sürükle, ya da Alt ve ok tuşlarını kullan.")}</p>
          {repeated.length > 0 && (
            <p className="editor__hint" role="status">
              {t("Birden fazla alınan eşya: {items}", { items: repeated.map((id) => data.items.get(id)?.name ?? id).join(", ") })}
            </p>
          )}
          <SearchInput label={t("Eşya ara")} value={query} onChange={setQuery} placeholder={t("{list} listesine eşya ekle", { list: t(current.label) })} />
          <Select
            label={t("Özellik")}
            value={stat}
            options={[{ value: "", label: t("Her özellik") }, ...statOptions.map((key) => ({ value: key, label: t(STAT_PRICES[key].label) }))]}
            onChange={setStat}
          />
          {found.length > 0 && (
            <ul className="editor__found">
              {found.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => addItem(item.id)} disabled={draft[list].length >= current.max}>
                    <img src={itemIconUrl(data.version, item.id)} alt="" width={24} height={24} />
                    {item.name} · {item.gold.total}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <FilterChips label={t("Koleksiyonlar")} chips={collections.map((c) => ({ id: c, label: t(c) }))} selected={draft.collections} onChange={(c) => set({ collections: c })} />

        <label className="field">
          <span className="field__label">{t("Notlar")}</span>
          <textarea className="text-input editor__notes" value={draft.notes} rows={3} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} />
        </label>
      </div>
    </Modal>
  );
}
