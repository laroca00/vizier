import { useState } from "react";
import { championNoteKey, matchupNoteKey, notedMatchups, updateSpace, usePersonal } from "../personal";
import { SPACE_LIMITS, safeUrl } from "../championSpace";
import { combosOf } from "../data/combos";
import type { Champion } from "../data/ddragon";
import { useT } from "../i18n";
import { POSITIONS } from "../labels";
import { openExternal } from "../links";
import { useLibrary } from "../library/store";
import { skillOrderLabel } from "../library/data";
import { Button } from "../ui/Button";
import { Select } from "../ui/Fields";
import "./workspace.css";

/** Everything the player keeps for one champion, read from the stores that already hold it. */
export function ChampionWorkspace({ champion, champions, onOpenBuild, onOpenMatchup }: { champion: Champion; champions: Map<number, Champion>; onOpenBuild: (id: string) => void; onOpenMatchup: (opponentId: number) => void }) {
  const t = useT();
  const personal = usePersonal();
  const { builds } = useLibrary();
  const space = personal.spaces[String(champion.key)] ?? { role: null, tags: [], reminders: [], links: [] };
  const mine = builds.filter((b) => b.championId === champion.key);
  const own = mine.filter((b) => b.source !== "pro");
  const pro = mine.filter((b) => b.source === "pro");
  const opponents = notedMatchups(personal, champion.key);
  const combos = personal.favs.filter((f) => f.kind === "combo" && f.championId === champion.key);
  const hasChampionNote = !!personal.notes[championNoteKey(champion.key)]?.trim();
  const comboName = (id: string) => combosOf(champion.id).find((c) => `${champion.id}/${c.id}` === id)?.id ?? id;

  return (
    <div className="workspace">
      <section aria-label={t("Tercih")}>
        <h2 className="draft__heading">{t("Tercih edilen rol")}</h2>
        <Select
          label={t("Rol")}
          value={space.role ?? ""}
          onChange={(role) => updateSpace(champion.key, (s) => ({ ...s, role: role || null }))}
          options={[{ value: "", label: t("Belirtilmedi") }, ...Object.entries(POSITIONS).map(([value, label]) => ({ value, label: t(label) }))]}
        />
      </section>

      <section aria-label={t("Buildlerim")}>
        <h2 className="draft__heading">{t("Buildlerim")}</h2>
        {own.length === 0 ? <p className="build__note">{t("Bu şampiyon için kayıtlı build yok.")}</p> : (
          <ul className="workspace__list">
            {own.map((b) => (
              <li key={b.id}>
                <button type="button" className="workspace__link" onClick={() => onOpenBuild(b.id)}>{b.name}</button>
                <span className="build__stat">{skillOrderLabel(b.skillOrder)} · {t("{count} eşya", { count: b.coreItems.length + b.items.length })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t("Rünlerim")}>
        <h2 className="draft__heading">{t("Rünlerim")}</h2>
        {own.length === 0 ? <p className="build__note">{t("Rün sayfaları kayıtlı buildlerde durur.")}</p> : (
          <ul className="workspace__list">
            {own.map((b) => (
              <li key={b.id}>
                <button type="button" className="workspace__link" onClick={() => onOpenBuild(b.id)}>{b.name}</button>
                <span className="build__stat">{t("{count} rün", { count: b.runes.perks.length })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t("Kayıtlı pro build'ler")}>
        <h2 className="draft__heading">{t("Kayıtlı pro build'ler")}</h2>
        {pro.length === 0 ? <p className="build__note">{t("Pro build'lerden kaydettiğin build burada görünür.")}</p> : (
          <ul className="workspace__list">
            {pro.map((b) => (
              <li key={b.id}>
                <button type="button" className="workspace__link" onClick={() => onOpenBuild(b.id)}>{b.name}</button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label={t("Eşleşme notlarım")}>
        <h2 className="draft__heading">{t("Eşleşme notlarım")}</h2>
        {opponents.length === 0 ? <p className="build__note">{t("Henüz eşleşme notu yok.")}</p> : (
          <ul className="workspace__list">
            {opponents.map((id) => (
              <li key={id}>
                <button type="button" className="workspace__link" onClick={() => onOpenMatchup(id)}>{champions.get(id)?.name ?? id}</button>
                <span className="build__stat">{personal.notes[matchupNoteKey(champion.key, id)]?.slice(0, 60)}</span>
              </li>
            ))}
          </ul>
        )}
        {hasChampionNote && <p className="build__stat">{t("Şampiyon notun var; aşağıda.")}</p>}
      </section>

      <section aria-label={t("Favori kombolar")}>
        <h2 className="draft__heading">{t("Favori kombolar")}</h2>
        {combos.length === 0 ? <p className="build__note">{t("Kombo kartındaki yıldızla favori ekle.")}</p> : (
          <ul className="workspace__list">{combos.map((f) => <li key={f.id}>{f.label || comboName(f.id)}</li>)}</ul>
        )}
      </section>

      <ListEditor
        title={t("Etiketler")}
        items={space.tags}
        max={SPACE_LIMITS.tags}
        placeholder={t("Etiket ekle")}
        onAdd={(text) => updateSpace(champion.key, (s) => ({ ...s, tags: [...s.tags, text] }))}
        onRemove={(i) => updateSpace(champion.key, (s) => ({ ...s, tags: s.tags.filter((_, j) => j !== i) }))}
      />
      <ListEditor
        title={t("Hatırlatmalar")}
        items={space.reminders}
        max={SPACE_LIMITS.reminders}
        placeholder={t("Kısa bir hatırlatma yaz")}
        onAdd={(text) => updateSpace(champion.key, (s) => ({ ...s, reminders: [...s.reminders, text] }))}
        onRemove={(i) => updateSpace(champion.key, (s) => ({ ...s, reminders: s.reminders.filter((_, j) => j !== i) }))}
      />
      <LinkEditor links={space.links} onAdd={(link) => updateSpace(champion.key, (s) => ({ ...s, links: [...s.links, link] }))} onRemove={(i) => updateSpace(champion.key, (s) => ({ ...s, links: s.links.filter((_, j) => j !== i) }))} />
    </div>
  );
}

function ListEditor({ title, items, max, placeholder, onAdd, onRemove }: { title: string; items: string[]; max: number; placeholder: string; onAdd: (text: string) => void; onRemove: (index: number) => void }) {
  const t = useT();
  const [text, setText] = useState("");
  return (
    <section aria-label={title}>
      <h2 className="draft__heading">{title}</h2>
      <ul className="workspace__list">
        {items.map((item, i) => (
          <li key={item}>
            <span>{item}</span>
            <button type="button" className="workspace__remove" aria-label={t("Kaldır: {name}", { name: item })} onClick={() => onRemove(i)}>×</button>
          </li>
        ))}
      </ul>
      {items.length < max && (
        <form className="workspace__add" onSubmit={(e) => { e.preventDefault(); if (text.trim()) onAdd(text.trim()); setText(""); }}>
          <input value={text} maxLength={SPACE_LIMITS.text} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" size="small">{t("Ekle")}</Button>
        </form>
      )}
    </section>
  );
}

function LinkEditor({ links, onAdd, onRemove }: { links: { title: string; url: string }[]; onAdd: (link: { title: string; url: string }) => void; onRemove: (index: number) => void }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [bad, setBad] = useState(false);
  return (
    <section aria-label={t("Bağlantılar")}>
      <h2 className="draft__heading">{t("Bağlantılar")}</h2>
      <ul className="workspace__list">
        {links.map((link, i) => (
          <li key={link.url}>
            <button type="button" className="workspace__link" onClick={() => openExternal(link.url)}>{link.title}</button>
            <button type="button" className="workspace__remove" aria-label={t("Kaldır: {name}", { name: link.title })} onClick={() => onRemove(i)}>×</button>
          </li>
        ))}
      </ul>
      {links.length < SPACE_LIMITS.links && (
        <form
          className="workspace__add"
          onSubmit={(e) => {
            e.preventDefault();
            const safe = safeUrl(url);
            setBad(!safe);
            if (!safe) return;
            onAdd({ title: title.trim() || new URL(safe).hostname, url: safe });
            setTitle("");
            setUrl("");
          }}
        >
          <input value={title} maxLength={60} placeholder={t("Başlık")} aria-label={t("Başlık")} onChange={(e) => setTitle(e.target.value)} />
          <input value={url} placeholder="https://" aria-label={t("Bağlantı")} aria-invalid={bad || undefined} onChange={(e) => setUrl(e.target.value)} />
          <Button type="submit" size="small">{t("Ekle")}</Button>
        </form>
      )}
      {bad && <p className="build__note">{t("Yalnızca http veya https bağlantısı eklenebilir.")}</p>}
    </section>
  );
}
