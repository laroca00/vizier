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
type Toggle = Exclude<keyof Settings, "language">;

const TOGGLES: { key: Toggle; label: string; hint: string }[] = [
  { key: "autoImportRunes", label: "Rünleri kendiliğinden aktar", hint: "Şampiyonunu kilitlediğinde önerilen rün sayfası Vizier sayfasına yazılır." },
  { key: "autoImportSpells", label: "Büyüleri kendiliğinden aktar", hint: "Flash kullandığın tuşta kalır." },
  { key: "autoImportItems", label: "Eşya setini kendiliğinden aktar", hint: "Önerilen eşyalar oyun içi mağazada Vizier seti olarak görünür." },
  { key: "showOnChampSelect", label: "Şampiyon seçiminde Vizier'i öne getir", hint: "Tepsideyken bile seçim başlayınca pencere açılır." },
  { key: "openAnalysisAfterGame", label: "Maç bitince analizi aç", hint: "Riot maçı yayınlar yayınlamaz analiz ekrana gelir." },
  { key: "pauseBackgroundInGame", label: "Oyundayken arka plan animasyonunu durdur", hint: "Oyun sırasında ekran kartına yük bindirmez." },
];

const OVERLAY_TOGGLES: { key: Toggle; label: string; hint: string }[] = [
  { key: "overlayScouting", label: "Yükleme ekranında oyuncular", hint: "Herkesin dereceli sırası, sezon kazanma oranı ve şampiyonundaki ustalığı." },
  { key: "overlaySkills", label: "Yetenek önerisi", hint: "Yetenek puanın olduğunda hangisini yükselteceğini gösterir." },
  { key: "overlayObjectives", label: "Ejder, Baron ve inhibitör süreleri", hint: "Kesildiklerinde yeniden doğmalarına kalan süre." },
  { key: "overlayBenchmarks", label: "Emerald+ karşılaştırması", hint: "Dakika başına minyonun ve skora katkın, aynı roldeki Emerald+ medyanıyla." },
  { key: "overlayPace", label: "Tempo", hint: "Toplam minyon ve kamp sayın, aynı şampiyonu oynayan Emerald+ oyuncuların o dakikadaki medyanıyla. İlk 15 dakika." },
  { key: "overlayItems", label: "Eşya altını farkı", hint: "Koridor rakibine ve rakip takıma göre eşyalarına harcanan altın." },
  { key: "overlayScoreboard", label: "Skor tablosunda eşya farkı", hint: "Tab'a basılıyken her oyuncunun karşısındakine göre eşya altını farkı, tablonun ortasında." },
  { key: "overlayNextItem", label: "Sıradaki eşya", hint: "Seçtiğin build türünde henüz almadığın ilk eşya ve ona kalan altın." },
  { key: "overlayGoal", label: "Koçun hedefi", hint: "Son maçlarında koçun bulduğu zayıf nokta, bu maçta canlı takip edilir." },
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
      <p className="settings__note">
        {t("Pencereyi kapattığında Vizier sistem tepsisinde çalışmaya devam eder. Tamamen kapatmak için tepsi simgesine sağ tıklayıp Çıkış'ı seç.")}
      </p>
    </LiquidGlass>
  );
}
