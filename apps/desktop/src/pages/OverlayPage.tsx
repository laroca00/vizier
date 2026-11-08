import { updateSettings, useSettings } from "../settings";
import { useT } from "../i18n";
import { Toggle } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import type { ToggleKey } from "./SettingsPage";

const WIDGETS: { key: ToggleKey; label: string; hint: string }[] = [
  { key: "overlaySkills", label: "Yetenek önerisi", hint: "Yetenek puanın olduğunda hangisini yükselteceğini gösterir." },
  { key: "overlayObjectives", label: "Ejder, Baron ve inhibitör süreleri", hint: "Kesildiklerinde yeniden doğmalarına kalan süre." },
  { key: "overlayItems", label: "Eşya altını farkı", hint: "Koridor rakibine ve rakip takıma göre eşyalarına harcanan altın." },
  { key: "overlayScoreboard", label: "Skor tablosunda eşya farkı", hint: "Tab'a basılıyken her oyuncunun karşısındakine göre eşya altını farkı, tablonun ortasında." },
  { key: "overlayAugments", label: "Augment önerisi", hint: "Arena ve Şamata'da şampiyonunun her nadirlikteki en iyi augment'leri." },
  { key: "overlayNextItem", label: "Sıradaki eşya", hint: "Seçtiğin build türünde henüz almadığın ilk eşya ve ona kalan altın." },
  { key: "overlayTimers", label: "Elle başlatılan zamanlayıcılar", hint: "Kamp, ejder ve Baron zamanlayıcıları, kronometre ve ilk doğuş hatırlatıcıları. Kısayollar aşağıda." },
  { key: "timerSound", label: "Zamanlayıcı sesi", hint: "Bir süre dolmadan 30 saniye önce ve dolunca kısa bir ses çalar." },
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl+Shift+O", "Paneli gizle ya da göster"],
  ["Ctrl+Shift+L", "Kutuları yerleştir"],
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

/** What the in-game overlay shows and how to control it. */
export function OverlayPage() {
  const settings = useSettings();
  const t = useT();
  const off = !settings.overlay;

  return (
    <LiquidGlass className="panel settings" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Overlay")} subtitle={t("Oyun sırasında ekranın kenarında duran panel.")} />

      <section className="settings__section enter">
        <Toggle
          label={t("Oyun içi paneli göster")}
          hint={t("Tıklamaları oyuna geçirir. Tam ekranda görünmezse oyun ayarlarından Kenarlıksız pencereyi seç.")}
          checked={settings.overlay}
          onChange={(overlay) => updateSettings({ overlay })}
        />
      </section>

      <section className="settings__section enter" aria-labelledby="overlay-widgets">
        <h2 id="overlay-widgets" className="section-title">{t("Paneldekiler")}</h2>
        {WIDGETS.map(({ key, label, hint }) => (
          <Toggle key={key} label={t(label)} hint={t(hint)} checked={settings[key]} disabled={off} onChange={(checked) => updateSettings({ [key]: checked })} />
        ))}
        <label className="settings__number">
          <span className="toggle__label">{t("Özel zamanlayıcının süresi, saniye")}</span>
          <input
            type="number"
            min={10}
            max={1800}
            step={5}
            value={settings.customTimerSeconds}
            disabled={off || !settings.overlayTimers}
            onChange={(event) => {
              const seconds = Math.round(Number(event.target.value));
              if (seconds >= 10 && seconds <= 1800) updateSettings({ customTimerSeconds: seconds });
            }}
          />
        </label>
      </section>

      <section className="settings__section enter" aria-labelledby="overlay-keys">
        <h2 id="overlay-keys" className="section-title">{t("Kısayollar")}</h2>
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
      </section>
    </LiquidGlass>
  );
}
