import { useRef, useState } from "react";
import { champions as loadChampions, items as loadItems } from "../data/ddragon";
import { useT } from "../i18n";
import { parseNoteKey } from "../journalNotes";
import { importBuilds, useLibrary } from "../library/store";
import { replaceNotes, usePersonal } from "../personal";
import { getSavedDrafts, importDrafts, useSavedDrafts } from "../simulator/store";
import { Button } from "../ui/Button";
import { Toggle } from "../ui/Fields";
import { useToast } from "../ui/Toast";
import { buildsCsv, countStatus, notesCsv, PARTS, previewImport, readWorkspaceFile, selectForImport, workspaceFile, type Incoming, type Part, type PreviewRow } from "./dataFile";

const PART_TEXT: Record<Part, string> = { builds: "Build'ler", drafts: "Draft şablonları", notes: "Notlar" };

function save(text: string, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Moves builds, draft templates and notes in and out as files, showing what an import would change before it does. */
export function DataWorkspace() {
  const t = useT();
  const toast = useToast();
  const { builds } = useLibrary();
  const drafts = useSavedDrafts();
  const { notes } = usePersonal();
  const [parts, setParts] = useState<Part[]>(PARTS);
  const [pending, setPending] = useState<{ incoming: Incoming; rows: PreviewRow[] } | null>(null);
  const [withChanged, setWithChanged] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const contents = { builds, drafts, notes };

  const toggle = (part: Part) => setParts((p) => (p.includes(part) ? p.filter((x) => x !== part) : [...p, part]));

  async function names() {
    const list = await loadChampions().catch(() => null);
    return (id: number) => list?.get(id)?.name ?? String(id);
  }

  async function csv(kind: "builds" | "notes") {
    const name = await names();
    if (kind === "builds") save(buildsCsv(builds, name), "vizier-builds.csv", "text/csv");
    else
      save(
        notesCsv(notes, (key) => {
          const parsed = parseNoteKey(key);
          if (!parsed) return key;
          return parsed.opponentId ? `${name(parsed.championId)} – ${name(parsed.opponentId)}` : name(parsed.championId);
        }),
        "vizier-notes.csv",
        "text/csv",
      );
  }

  async function read(file: File | undefined) {
    if (!file) return;
    try {
      const incoming = readWorkspaceFile(await file.text());
      const [champions, items] = await Promise.all([loadChampions().catch(() => null), loadItems().catch(() => null)]);
      const known = { champions: champions ? new Set(champions.keys()) : null, items: items ? new Set(items.keys()) : null };
      setPending({ incoming, rows: previewImport(incoming, { builds, drafts: getSavedDrafts(), notes }, known) });
      setWithChanged(false);
    } catch (error) {
      toast("error", error instanceof Error && error.message === "too-new" ? t("Bu dosya Vizier'in daha yeni bir sürümünden. Uygulamayı güncelle.") : t("Bu dosya bir Vizier çalışma alanı dosyası değil."));
    }
  }

  function apply() {
    if (!pending) return;
    const chosen = selectForImport(pending.incoming, pending.rows, withChanged);
    if (chosen.builds.length) importBuilds(chosen.builds);
    if (chosen.drafts.length) importDrafts(chosen.drafts);
    if (Object.keys(chosen.notes).length) replaceNotes({ ...notes, ...chosen.notes });
    toast("success", t("{count} kayıt içe aktarıldı.", { count: chosen.builds.length + chosen.drafts.length + Object.keys(chosen.notes).length }));
    setPending(null);
  }

  const present = pending ? PARTS.filter((p) => pending.rows.some((r) => r.part === p)) : [];
  const importable = pending ? pending.rows.filter((r) => r.status === "new" || (withChanged && r.status === "changed" && r.part !== "notes")).length : 0;

  return (
    <section className="settings__section enter" aria-labelledby="settings-workspace">
      <h2 id="settings-workspace" className="section-title">{t("Çalışma alanı verileri")}</h2>
      <p className="settings__note">{t("Build'lerini, draft şablonlarını ve notlarını ayrı ayrı ya da birlikte dosyaya al. İçe aktarmadan önce neyin değişeceğini görürsün; var olan hiçbir şeyin üstüne yazılmaz.")}</p>
      <div className="settings__actions">
        {PARTS.map((part) => (
          <Toggle key={part} label={t(PART_TEXT[part])} checked={parts.includes(part)} onChange={() => toggle(part)} />
        ))}
      </div>
      <div className="settings__actions">
        <Button disabled={parts.length === 0} onClick={() => save(workspaceFile(parts, contents), "vizier-workspace.json", "application/json")}>{t("JSON olarak dışa aktar")}</Button>
        <Button onClick={() => csv("builds")}>{t("Build'ler (CSV)")}</Button>
        <Button onClick={() => csv("notes")}>{t("Notlar (CSV)")}</Button>
        <Button onClick={() => input.current?.click()}>{t("Dosyadan içe aktar")}</Button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => { read(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      {pending && (
        <div className="settings__note" role="region" aria-label={t("İçe aktarma önizlemesi")}>
          {present.length === 0 ? <p>{t("Dosyada içe aktarılacak kayıt yok.")}</p> : (
            <table>
              <thead>
                <tr><th>{t("Tür")}</th><th>{t("Yeni")}</th><th>{t("Değişmiş")}</th><th>{t("Aynı")}</th><th>{t("Atlanan")}</th></tr>
              </thead>
              <tbody>
                {present.map((part) => (
                  <tr key={part}>
                    <td>{t(PART_TEXT[part])}</td>
                    <td>{countStatus(pending.rows, part, "new")}</td>
                    <td>{countStatus(pending.rows, part, "changed")}</td>
                    <td>{countStatus(pending.rows, part, "same")}</td>
                    <td>{countStatus(pending.rows, part, "skipped")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <ul>
            {pending.rows.filter((r) => r.status === "skipped").slice(0, 8).map((r) => (
              <li key={`${r.part}${r.id}`}>{t("{name} atlandı: {reason}", { name: r.name, reason: r.reason === "item" ? t("bilinmeyen eşya") : t("bilinmeyen şampiyon") })}</li>
            ))}
          </ul>
          <Toggle label={t("Değişen build ve draft'ları kopya olarak ekle")} hint={t("Notlarda senin yazdığın metin her zaman kalır.")} checked={withChanged} onChange={setWithChanged} />
          <div className="settings__actions">
            <Button variant="primary" disabled={importable === 0} onClick={apply}>{t("{count} kaydı içe aktar", { count: importable })}</Button>
            <Button variant="ghost" onClick={() => setPending(null)}>{t("Vazgeç")}</Button>
          </div>
        </div>
      )}
    </section>
  );
}
