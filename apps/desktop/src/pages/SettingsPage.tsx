import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { updateSettings, useSettings, type Settings } from "../settings";
import { useT, type LanguageSetting } from "../i18n";
import { LiquidGlass } from "../ui/LiquidGlass";

const LANGUAGES: { id: LanguageSetting; label: string }[] = [
  { id: "auto", label: "League istemcisinin dili" },
  { id: "tr", label: "Türkçe" },
  { id: "en", label: "English" },
];

/** The on/off settings; language is a choice, not a toggle. */
type Toggle = Exclude<keyof Settings, "language" | "customTimerSeconds">;

const TOGGLES: { key: Toggle; label: string; hint: string }[] = [
  { key: "autoImportRunes", label: "Rünleri kendiliğinden aktar", hint: "Şampiyonunu kilitlediğinde önerilen rün sayfası Vizier sayfasına yazılır." },
  { key: "autoImportSpells", label: "Büyüleri kendiliğinden aktar", hint: "Flash kullandığın tuşta kalır." },
  { key: "autoImportItems", label: "Eşya setini kendiliğinden aktar", hint: "Önerilen eşyalar oyun içi mağazada Vizier seti olarak görünür." },
  { key: "showOnChampSelect", label: "Şampiyon seçiminde Vizier'i öne getir", hint: "Tepsideyken bile seçim başlayınca pencere açılır." },
];

const OVERLAY_TOGGLES: { key: Toggle; label: string; hint: string }[] = [
  { key: "overlaySkills", label: "Yetenek önerisi", hint: "Yetenek puanın olduğunda hangisini yükselteceğini gösterir." },
  { key: "overlayObjectives", label: "Ejder, Baron ve inhibitör süreleri", hint: "Kesildiklerinde yeniden doğmalarına kalan süre." },
  { key: "overlayItems", label: "Eşya altını farkı", hint: "Koridor rakibine ve rakip takıma göre eşyalarına harcanan altın." },
  { key: "overlayScoreboard", label: "Skor tablosunda eşya farkı", hint: "Tab'a basılıyken her oyuncunun karşısındakine göre eşya altını farkı, tablonun ortasında." },
  { key: "overlayNextItem", label: "Sıradaki eşya", hint: "Seçtiğin build türünde henüz almadığın ilk eşya ve ona kalan altın." },
  { key: "overlayTimers", label: "Elle başlatılan zamanlayıcılar", hint: "Kamp, ejder ve Baron zamanlayıcıları, kronometre ve ilk doğuş hatırlatıcıları. Kısayollar aşağıda." },
  { key: "timerSound", label: "Zamanlayıcı sesi", hint: "Bir süre dolmadan 30 saniye önce ve dolunca kısa bir ses çalar." },
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl+Shift+1", "Mavi"],
  ["Ctrl+Shift+2", "Kırmızı"],
  ["Ctrl+Shift+3", "Gromp"],
  ["Ctrl+Shift+4", "Kurtlar"],
  ["Ctrl+Shift+5", "Kuşlar"],
  ["Ctrl+Shift+6", "Golemler"],
  ["Ctrl+Shift+7", "Yengeç"],
  ["Ctrl+Shift+D", "Ejder"],
  ["Ctrl+Shift+B", "Baron"],
  ["Ctrl+Shift+T", "Özel zamanlayıcı"],
  ["Ctrl+Shift+S", "Kronometreyi başlat ya da durdur"],
  ["Ctrl+Shift+X", "Hepsini temizle"],
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
  const [autostart, setAutostart] = useAutostart();

  return (
    <LiquidGlass className="panel settings" radius={28} strength={2.5} scroll>
      <h1 className="about__title enter">{t("Ayarlar")}</h1>
      <label className="settings__language enter">
        <span className="toggle__label">{t("Dil")}</span>
        <select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value as LanguageSetting })}>
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.id === "auto" ? t(l.label) : l.label}
            </option>
          ))}
        </select>
      </label>
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
              <span className="toggle__label">{t("Windows açılınca Vizier'i başlat")}</span>
              <span className="toggle__hint">{t("Sistem tepsisinde sessizce bekler.")}</span>
            </span>
          </label>
        </li>
        {TOGGLES.map(({ key, label, hint }) => (
          <li key={key}>
            <label className="toggle">
              <input type="checkbox" checked={settings[key]} onChange={(e) => updateSettings({ [key]: e.target.checked })} />
              <span className="toggle__text">
                <span className="toggle__label">{t(label)}</span>
                <span className="toggle__hint">{t(hint)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <h2 className="settings__heading enter">{t("Oyun içi")}</h2>
      <ul className="settings__list enter">
        <li>
          <label className="toggle">
            <input type="checkbox" checked={settings.overlay} onChange={(e) => updateSettings({ overlay: e.target.checked })} />
            <span className="toggle__text">
              <span className="toggle__label">{t("Oyun içi paneli göster")}</span>
              <span className="toggle__hint">
                {t("Tıklamaları oyuna geçirir. Ctrl+Shift+L ile kutuları sürükleyip yerleştirebilir, Ctrl+Shift+O ile gizleyip açabilirsin. Tam ekranda görünmezse oyun ayarlarından Kenarlıksız pencereyi seç.")}
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
                <span className="toggle__label">{t(label)}</span>
                <span className="toggle__hint">{t(hint)}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <label className="settings__language enter">
        <span className="toggle__label">{t("Özel zamanlayıcının süresi, saniye")}</span>
        <input
          type="number"
          min={10}
          max={1800}
          step={5}
          value={settings.customTimerSeconds}
          disabled={!settings.overlay || !settings.overlayTimers}
          onChange={(e) => {
            const seconds = Math.round(Number(e.target.value));
            if (seconds >= 10 && seconds <= 1800) updateSettings({ customTimerSeconds: seconds });
          }}
        />
      </label>
      <div className="enter">
        <h2 className="settings__heading">{t("Zamanlayıcı kısayolları")}</h2>
        <p className="settings__note">{t("Yalnızca maç sırasında çalışır; geri kalan zamanda bu tuşlar diğer uygulamalara aittir.")}</p>
        <dl className="shortcuts">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={keys}>
              <dt>
                <kbd>{keys}</kbd>
              </dt>
              <dd>{t(label)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="settings__note">
        {t("Pencereyi kapattığında Vizier sistem tepsisinde çalışmaya devam eder. Tamamen kapatmak için tepsi simgesine sağ tıklayıp Çıkış'ı seç.")}
      </p>
    </LiquidGlass>
  );
}
