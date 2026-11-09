import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { updateSettings, useSettings } from "../settings";
import { useT } from "../i18n";
import { Button } from "../ui/Button";
import { Select, Toggle } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { HOTKEY_ACTIONS, changedHotkeys, clashing, comboFromEvent, effectiveHotkeys } from "../overlay/hotkeys";
import { OPACITY_RANGE, SCALE_RANGE, THEMES, normalizeStyle, withWidgetStyle, type OverlayTheme } from "../overlay/appearance";
import { REF_NAMES, REF_SECTIONS, moveRef, toggleRef } from "../overlay/reference";
import { WIDGETS, type OverlayMode } from "../overlay/registry";
import { WidgetPreview } from "../overlay/WidgetPreview";
import type { ToggleKey } from "./SettingsPage";
import "../overlay/overlay-page.css";

const MODE_NAMES: Record<OverlayMode, string> = { rift: "Yarık", aram: "ARAM", arena: "Arena", mayhem: "Şamata" };

const SETTING_LABELS: Partial<Record<ToggleKey, string>> = {
  overlayObjectives: "Ejder, Baron ve inhibitör süreleri",
  overlayTimers: "Elle başlatılan zamanlayıcılar",
};

/** What the in-game overlay shows, where, and how to control it. */
export function OverlayPage() {
  const settings = useSettings();
  const t = useT();
  const off = !settings.overlay;
  const [capturing, setCapturing] = useState<string | null>(null);
  const keys = effectiveHotkeys(settings.hotkeys);
  const clashes = clashing(settings.hotkeys);

  useEffect(() => {
    if (!capturing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      if (event.code === "Escape") return setCapturing(null);
      const combo = comboFromEvent(event);
      if (!combo) return;
      updateSettings({ hotkeys: { ...settings.hotkeys, [capturing]: combo } });
      setCapturing(null);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [capturing, settings.hotkeys]);

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
        <div className="settings__actions">
          <Button disabled={off || !isTauri()} onClick={() => invoke("set_overlay_editing", { editing: true }).catch(() => {})}>
            {t("Kutuları yerleştir")}
          </Button>
          <label className="settings__number">
            <span className="toggle__label">{t("Boyut")}</span>
            <input
              type="range"
              min={0.8}
              max={1.4}
              step={0.05}
              value={settings.overlayScale}
              disabled={off}
              aria-label={t("Boyut")}
              onChange={(event) => updateSettings({ overlayScale: Number(event.target.value) })}
            />
            <span>{Math.round(settings.overlayScale * 100)}%</span>
          </label>
        </div>
        <div className="settings__actions">
          <Select
            label={t("Renk")}
            value={settings.overlayTheme}
            options={THEMES.map((th) => ({ value: th.id, label: t(th.name) }))}
            onChange={(overlayTheme: OverlayTheme) => updateSettings({ overlayTheme })}
          />
        </div>
        <Toggle
          label={t("Yükleme ekranında oyuncuları göster")}
          hint={t("Dereceleri, ustalıkları ve takımların hasar dağılımını gösterir. Dereceler Vizier'in sunucusundan gelir; ayarlanmamışsa yalnızca hasar dağılımı görünür. Gizlemek için paneli gizleme kısayolunu kullan.")}
          checked={settings.overlayScouting}
          disabled={off}
          onChange={(overlayScouting) => updateSettings({ overlayScouting })}
        />
        <p className="settings__note">{t("Yerleşim her oyun türü ve ekran boyutu için ayrı tutulur.")}</p>
      </section>

      <section className="settings__section enter" aria-labelledby="overlay-widgets">
        <h2 id="overlay-widgets" className="section-title">{t("Paneldekiler")}</h2>
        <ul className="overlay-widgets">
          {WIDGETS.map((def) => (
            <li key={def.id} className="overlay-widgets__item">
              <WidgetPreview id={def.id} />
              <div className="overlay-widgets__body">
                <h3 className="overlay-widgets__name">{t(def.name)}</h3>
                <p className="settings__note">{t(def.hint)}</p>
                <p className="overlay-widgets__modes">{def.modes.map((m) => t(MODE_NAMES[m])).join(" · ")}</p>
                <div className="overlay-widgets__style">
                  {!def.fixed && (
                    <label className="settings__number">
                      <span className="toggle__label">{t("Boyut")}</span>
                      <input
                        type="range"
                        {...SCALE_RANGE}
                        value={normalizeStyle(settings.overlayWidgetStyles[def.id]).scale}
                        disabled={off}
                        aria-label={`${t(def.name)}: ${t("Boyut")}`}
                        onChange={(event) => updateSettings({ overlayWidgetStyles: withWidgetStyle(settings.overlayWidgetStyles, def.id, { scale: Number(event.target.value) }) })}
                      />
                      <span>{Math.round(normalizeStyle(settings.overlayWidgetStyles[def.id]).scale * 100)}%</span>
                    </label>
                  )}
                  <label className="settings__number">
                    <span className="toggle__label">{t("Saydamlık")}</span>
                    <input
                      type="range"
                      {...OPACITY_RANGE}
                      value={normalizeStyle(settings.overlayWidgetStyles[def.id]).opacity}
                      disabled={off}
                      aria-label={`${t(def.name)}: ${t("Saydamlık")}`}
                      onChange={(event) => updateSettings({ overlayWidgetStyles: withWidgetStyle(settings.overlayWidgetStyles, def.id, { opacity: Number(event.target.value) }) })}
                    />
                    <span>{Math.round(normalizeStyle(settings.overlayWidgetStyles[def.id]).opacity * 100)}%</span>
                  </label>
                </div>
                {def.id === "reference" && (
                  <ul className="overlay-widgets__ref" aria-label={t("Bloklar")}>
                    {[...settings.overlayRefSections, ...REF_SECTIONS.filter((s) => !settings.overlayRefSections.includes(s))].map((section) => {
                      const on = settings.overlayRefSections.includes(section);
                      return (
                        <li key={section}>
                          <Toggle label={t(REF_NAMES[section])} checked={on} disabled={off} onChange={() => updateSettings({ overlayRefSections: toggleRef(settings.overlayRefSections, section) })} />
                          {on && (
                            <span className="overlay-widgets__move">
                              <button type="button" aria-label={t("Yukarı taşı")} onClick={() => updateSettings({ overlayRefSections: moveRef(settings.overlayRefSections, section, -1) })}>↑</button>
                              <button type="button" aria-label={t("Aşağı taşı")} onClick={() => updateSettings({ overlayRefSections: moveRef(settings.overlayRefSections, section, 1) })}>↓</button>
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {def.settings.map((key) => (
                  <Toggle
                    key={key}
                    label={def.settings.length > 1 ? t(SETTING_LABELS[key as ToggleKey] ?? def.name) : t("Göster")}
                    checked={Boolean(settings[key])}
                    disabled={off}
                    onChange={(checked) => updateSettings({ [key]: checked })}
                  />
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="settings__actions" aria-label={t("Minimap")}>
          <Select
            label={t("Minimap köşesi")}
            value={settings.overlayMinimapSide as "left" | "right"}
            options={[
              { value: "right", label: t("Sağ alt") },
              { value: "left", label: t("Sol alt") },
            ]}
            onChange={(overlayMinimapSide) => updateSettings({ overlayMinimapSide })}
          />
          <label className="settings__number">
            <span className="toggle__label">{t("Minimap boyutu")}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings.overlayMinimapSize}
              disabled={off || !settings.overlayMinimap}
              aria-label={t("Minimap boyutu")}
              onChange={(event) => updateSettings({ overlayMinimapSize: Number(event.target.value) })}
            />
          </label>
          <Select
            label={t("Kamp süreleri hangi ormanda")}
            value={settings.overlayCampSide}
            options={[
              { value: "enemy", label: t("Rakip orman") },
              { value: "own", label: t("Kendi ormanım") },
            ]}
            onChange={(overlayCampSide) => updateSettings({ overlayCampSide })}
          />
        </div>
        <p className="settings__note">{t("Minimap boyutunu oyundaki minimap ölçeğine uydur. Yerler Vizier'in kabaca okuduğu harita noktalarıdır; birkaç piksel kayabilir.")}</p>
        <Toggle label={t("Zamanlayıcı sesi")} hint={t("Bir süre dolmadan 30 saniye önce ve dolunca kısa bir ses çalar.")} checked={settings.timerSound} disabled={off} onChange={(timerSound) => updateSettings({ timerSound })} />
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
        <p className="settings__note">{t("Zamanlayıcı kısayolları yalnızca maç sırasında çalışır; geri kalan zamanda bu tuşlar diğer uygulamalara aittir. Değiştirmek için tuşa tıkla ve yeni kombinasyona bas.")}</p>
        <dl className="shortcuts">
          {HOTKEY_ACTIONS.map((action) => (
            <div key={action.id} data-clash={clashes.has(action.id) || undefined}>
              <dt>
                <button
                  type="button"
                  className="shortcuts__key"
                  aria-label={t("{action} kısayolunu değiştir", { action: t(action.label) })}
                  onClick={() => setCapturing(capturing === action.id ? null : action.id)}
                >
                  <kbd>{capturing === action.id ? t("Tuşa bas…") : keys[action.id]}</kbd>
                </button>
              </dt>
              <dd>
                {t(action.label)}
                {clashes.has(action.id) && <span className="shortcuts__clash"> · {t("Başka bir kısayolla aynı")}</span>}
              </dd>
            </div>
          ))}
        </dl>
        <div className="settings__actions">
          <Button variant="ghost" disabled={Object.keys(changedHotkeys(settings.hotkeys)).length === 0} onClick={() => updateSettings({ hotkeys: {} })}>
            {t("Kısayolları varsayılana döndür")}
          </Button>
        </div>
      </section>
    </LiquidGlass>
  );
}
