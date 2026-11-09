import { useState } from "react";
import { backupNow, readBackups, restoreBackup, type Backup } from "../backups";
import { useLang, useT } from "../i18n";
import { reloadApp } from "../localData";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/Modal";

/** The weekly copies of the player's local data, with a way to put one back. */
export function Backups() {
  const t = useT();
  const lang = useLang();
  const [list, setList] = useState<Backup[]>(readBackups);
  const [restoring, setRestoring] = useState<Backup | null>(null);
  const when = (at: number) => new Date(at).toLocaleString(lang === "tr" ? "tr-TR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <section className="settings__section enter" aria-labelledby="settings-backups">
      <h2 id="settings-backups" className="section-title">{t("Yedekler")}</h2>
      <p className="settings__note">{t("Vizier haftada bir tüm yerel verinin kopyasını alır ve son 5 kopyayı saklar. Birine dönmek mevcut verinin yerine geçer.")}</p>
      <div className="settings__actions">
        <Button onClick={() => setList(backupNow())}>{t("Şimdi yedekle")}</Button>
      </div>
      {list.length === 0 ? (
        <p className="settings__note">{t("Henüz yedek yok.")}</p>
      ) : (
        <ul className="workspace__list">
          {list.map((b) => (
            <li key={b.at}>
              <span>{when(b.at)}</span>
              <span className="build__stat">{t("{count} kayıt alanı", { count: Object.keys(b.entries).length })}</span>
              <Button size="small" variant="ghost" onClick={() => setRestoring(b)}>{t("Geri yükle")}</Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={restoring !== null}
        title={t("Bu yedeğe dön?")}
        message={t("Mevcut verinin yerine {date} tarihli yedek gelir. Önce dışa aktarmak istersen şimdi vazgeç.", { date: restoring ? when(restoring.at) : "" })}
        confirmLabel={t("Geri yükle")}
        onConfirm={() => {
          if (restoring) restoreBackup(restoring);
          reloadApp();
        }}
        onCancel={() => setRestoring(null)}
      />
    </section>
  );
}
