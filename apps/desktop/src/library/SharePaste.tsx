import { useEffect, useState } from "react";
import { champions } from "../data/ddragon";
import { useT } from "../i18n";
import { ConfirmDialog } from "../ui/Modal";
import { useToast } from "../ui/Toast";
import { findShareCode, readShareCode } from "./share";
import { createBuild, type BuildDraft } from "./store";

/**
 * Pasting a Vizier share code anywhere outside a text field offers to add the
 * build to the library. Text fields keep their own paste.
 */
export function SharePaste({ onAdded }: { onAdded: () => void }) {
  const t = useT();
  const toast = useToast();
  const [draft, setDraft] = useState<BuildDraft | null>(null);

  useEffect(() => {
    async function onPaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const code = findShareCode(event.clipboardData?.getData("text") ?? "");
      const read = code ? readShareCode(code) : null;
      if (!read) return;
      // A code for a champion this version doesn't know would only fail later.
      if (!(await champions().catch(() => null))?.has(read.championId)) return;
      setDraft(read);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  return (
    <ConfirmDialog
      open={draft !== null}
      title={t("Paylaşım kodu bulundu")}
      message={t("“{name}” build'ini kütüphanene ekleyelim mi?", { name: draft?.name ?? "" })}
      confirmLabel={t("Kütüphaneme ekle")}
      onCancel={() => setDraft(null)}
      onConfirm={() => {
        if (draft) {
          createBuild(draft);
          toast("success", t("{name} buildlerine eklendi", { name: draft.name }));
          onAdded();
        }
        setDraft(null);
      }}
    />
  );
}
