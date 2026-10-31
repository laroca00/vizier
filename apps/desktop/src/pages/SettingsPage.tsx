import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { updateSettings, useSettings, type Settings } from "../settings";
import { LiquidGlass } from "../ui/LiquidGlass";

const TOGGLES: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "autoImportRunes", label: "Rünleri kendiliğinden aktar", hint: "Şampiyonunu kilitlediğinde önerilen rün sayfası Vizier sayfasına yazılır." },
  { key: "autoImportSpells", label: "Büyüleri kendiliğinden aktar", hint: "Flash kullandığın tuşta kalır." },
  { key: "autoImportItems", label: "Eşya setini kendiliğinden aktar", hint: "Önerilen eşyalar oyun içi mağazada Vizier seti olarak görünür." },
  { key: "showOnChampSelect", label: "Şampiyon seçiminde Vizier'i öne getir", hint: "Tepsideyken bile seçim başlayınca pencere açılır." },
  { key: "openAnalysisAfterGame", label: "Maç bitince analizi aç", hint: "Riot maçı yayınlar yayınlamaz analiz ekrana gelir." },
  { key: "pauseBackgroundInGame", label: "Oyundayken arka plan animasyonunu durdur", hint: "Oyun sırasında ekran kartına yük bindirmez." },
];

const OVERLAY_TOGGLES: { key: keyof Settings; label: string; hint: string }[] = [
  { key: "overlaySkills", label: "Yetenek önerisi", hint: "Yetenek puanın olduğunda hangisini yükselteceğini gösterir." },
  { key: "overlayObjectives", label: "Ejder, Baron ve inhibitör süreleri", hint: "Kesildiklerinde yeniden doğmalarına kalan süre." },
  { key: "overlayBenchmarks", label: "Emerald+ karşılaştırması", hint: "Dakika başına minyonun ve skora katkın, aynı roldeki Emerald+ medyanıyla." },
  { key: "overlayItems", label: "Eşya altını farkı", hint: "Koridor rakibine ve rakip takıma göre eşyalarına harcanan altın." },
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
  const [autostart, setAutostart] = useAutostart();

  return (
    <LiquidGlass className="panel settings" radius={28} strength={2.5}>
      <h1 className="about__title enter">Ayarlar</h1>
      <ul className="settings__list enter">
        <li>
          <label className="toggle">
            <input
              type="checkbox"
              checked={autostart ?? false}
              disabled={autostart === null}
              onChange={(e) => setAutostart(e.target.checked)}
            />
            <span className="toggle__text">
              <span className="toggle__label">Windows açılınca Vizier'i başlat</span>
              <span className="toggle__hint">Sistem tepsisinde sessizce bekler.</span>
            </span>
          </label>
        </li>
        {TOGGLES.map(({ key, label, hint }) => (
          <li key={key}>
            <label className="toggle">
              <input type="checkbox" checked={settings[key]} onChange={(e) => updateSettings({ [key]: e.target.checked })} />
              <span className="toggle__text">
                <span className="toggle__label">{label}</span>
                <span className="toggle__hint">{hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <h2 className="settings__heading enter">Oyun içi</h2>
      <ul className="settings__list enter">
        <li>
          <label className="toggle">
            <input type="checkbox" checked={settings.overlay} onChange={(e) => updateSettings({ overlay: e.target.checked })} />
            <span className="toggle__text">
              <span className="toggle__label">Oyun içi paneli göster</span>
              <span className="toggle__hint">
                Sol üst köşede durur, tıklamaları oyuna geçirir. Oyun ayarlarında Kenarlıksız pencere seçili olmalı. Ctrl+Shift+O ile oyun sırasında gizleyip açabilirsin.
              </span>
            </span>
          </label>
        </li>
        {OVERLAY_TOGGLES.map(({ key, label, hint }) => (
          <li key={key}>
            <label className="toggle">
              <input
                type="checkbox"
                checked={settings[key]}
                disabled={!settings.overlay}
                onChange={(e) => updateSettings({ [key]: e.target.checked })}
              />
              <span className="toggle__text">
                <span className="toggle__label">{label}</span>
                <span className="toggle__hint">{hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <p className="settings__note">Pencereyi kapattığında Vizier sistem tepsisinde çalışmaya devam eder. Tamamen kapatmak için tepsi simgesine sağ tıklayıp Çıkış'ı seç.</p>
    </LiquidGlass>
  );
}
