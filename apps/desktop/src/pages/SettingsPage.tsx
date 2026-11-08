import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { clearLocalData, exportLocalData, importLocalData, reloadApp } from "../localData";
import { updateSettings, useSettings, type Settings } from "../settings";
import { useT, type LanguageSetting } from "../i18n";
import { Button } from "../ui/Button";
import { Select, Toggle } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { ConfirmDialog } from "../ui/Modal";
import { PageHeader } from "../ui/Page";
import { useToast } from "../ui/Toast";

const LANGUAGES: { id: LanguageSetting; label: string }[] = [
  { id: "auto", label: "League istemcisinin dili" },
  { id: "tr", label: "Türkçe" },
  { id: "en", label: "English" },
];

/** The on/off settings; language is a choice, not a toggle. */
export type ToggleKey = Exclude<keyof Settings, "language" | "customTimerSeconds">;

const CLIENT_TOGGLES: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "autoImportRunes", label: "Rünleri kendiliğinden aktar", hint: "Şampiyonunu kilitlediğinde önerilen rün sayfası Vizier sayfasına yazılır." },
  { key: "autoImportSpells", label: "Büyüleri kendiliğinden aktar", hint: "Flash kullandığın tuşta kalır." },
  { key: "autoImportItems", label: "Eşya setini kendiliğinden aktar", hint: "Önerilen eşyalar oyun içi mağazada Vizier seti olarak görünür." },
  { key: "readyCheckAlert", label: "Maç bulununca haber ver", hint: "Kısa bir ses çalar ve görev çubuğundaki simge yanıp söner." },
  { key: "showOnChampSelect", label: "Şampiyon seçiminde Vizier'i öne getir", hint: "Tepsideyken bile seçim başlayınca pencere açılır." },
];

function useAutostart() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    isEnabled().then(setOn, () => setOn(null));
  }, []);
  async function toggle(next: boolean) {
    await (next ? enable() : disable());
    setOn(await isEnabled());
  }
  return [on, toggle] as const;
}

export function SettingsPage() {
  const settings = useSettings();
  const t = useT();
  const toast = useToast();
  const [autostart, setAutostart] = useAutostart();
  const [confirmClear, setConfirmClear] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function download() {
    const url = URL.createObjectURL(exportLocalData());
    const link = document.createElement("a");
    link.href = url;
    link.download = `vizier-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast("success", t("Verilerin dışa aktarıldı."));
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    try {
      await importLocalData(file);
      reloadApp();
    } catch {
      toast("error", t("Bu dosya bir Vizier dışa aktarımı değil. Ayarlar sayfasından aktardığın .json dosyasını seç."));
    }
  }

  return (
    <LiquidGlass className="panel settings" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Ayarlar")} />

      <section className="settings__section enter" aria-labelledby="settings-general">
        <h2 id="settings-general" className="section-title">{t("Genel")}</h2>
        <Select
          label={t("Dil")}
          value={settings.language}
          options={LANGUAGES.map((l) => ({ value: l.id, label: l.id === "auto" ? t(l.label) : l.label }))}
          onChange={(language) => updateSettings({ language })}
        />
        <Toggle
          label={t("Windows açılınca Vizier'i başlat")}
          hint={t("Sistem tepsisinde sessizce bekler.")}
          checked={autostart ?? false}
          disabled={autostart === null}
          onChange={setAutostart}
        />
        <p className="settings__note">
          {t("Pencereyi kapattığında Vizier sistem tepsisinde çalışmaya devam eder. Tamamen kapatmak için tepsi simgesine sağ tıklayıp Çıkış'ı seç.")}
        </p>
      </section>

      <section className="settings__section enter" aria-labelledby="settings-client">
        <h2 id="settings-client" className="section-title">{t("League istemcisi")}</h2>
        {CLIENT_TOGGLES.map(({ key, label, hint }) => (
          <Toggle key={key} label={t(label)} hint={t(hint)} checked={settings[key]} onChange={(checked) => updateSettings({ [key]: checked })} />
        ))}
      </section>

      <section className="settings__section enter" aria-labelledby="settings-data">
        <h2 id="settings-data" className="section-title">{t("Veriler")}</h2>
        <p className="settings__note">
          {t("Ayarların, şampiyon havuzun, kayıtlı build ve draft'ların, notların, bilmece sonuçların ve overlay yerleşimin yalnızca bu bilgisayarda tutulur. Başka bir bilgisayara taşımak için dışa aktarıp orada içe aktarabilirsin.")}
        </p>
        <div className="settings__actions">
          <Button onClick={download}>{t("Dışa aktar")}</Button>
          <Button onClick={() => fileInput.current?.click()}>{t("İçe aktar")}</Button>
          <Button variant="ghost" onClick={() => setConfirmClear(true)}>
            {t("Verileri temizle")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(event) => {
              void upload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </section>

      <ConfirmDialog
        open={confirmClear}
        title={t("Veriler temizlensin mi?")}
        message={t("Ayarların, şampiyon havuzun, kayıtlı build ve draft'ların, notların, bilmece sonuçların ve overlay yerleşimin silinir. Bu geri alınamaz; istersen önce dışa aktar.")}
        confirmLabel={t("Temizle")}
        danger
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          clearLocalData();
          reloadApp();
        }}
      />
    </LiquidGlass>
  );
}
