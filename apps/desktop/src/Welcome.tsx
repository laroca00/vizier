import { useState } from "react";
import { useT } from "./i18n";
import { updateSettings, useSettings } from "./settings";
import { Button } from "./ui/Button";
import { Toggle } from "./ui/Fields";
import { Modal } from "./ui/Modal";
import { effectiveHotkeys } from "./overlay/hotkeys";
import "./Welcome.css";

const STEPS = ["select", "game", "keys"] as const;
type Step = (typeof STEPS)[number];

const TITLES: Record<Step, string> = {
  select: "Şampiyon seçiminde",
  game: "Oyunda",
  keys: "Her yerde",
};

/** Shown once: what Vizier does on its own, with the switches for it right there. */
export function Welcome({ onOpenOverlay }: { onOpenOverlay: () => void }) {
  const t = useT();
  const settings = useSettings();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;
  const done = () => updateSettings({ welcomeSeen: true });

  return (
    <Modal open={!settings.welcomeSeen} title={t("Vizier'e hoş geldin")} onClose={done} wide>
      <ol className="welcome__steps" aria-label={t("Adımlar")}>
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === index ? "step" : undefined} data-done={i < index || undefined}>
            <button type="button" onClick={() => setIndex(i)}>
              <span className="welcome__dot">{i + 1}</span>
              {t(TITLES[s])}
            </button>
          </li>
        ))}
      </ol>

      <div className="welcome__panel" key={step}>
        {step === "select" && (
          <>
            <p className="welcome__lead">{t("Şampiyonunu kilitlediğin an rünler, büyüler ve eşya seti istemciye yazılır. Bir şey yapman gerekmez.")}</p>
            <div className="welcome__toggles">
              <Toggle label={t("Rünleri kendiliğinden aktar")} checked={settings.autoImportRunes} onChange={(v) => updateSettings({ autoImportRunes: v })} />
              <Toggle label={t("Büyüleri kendiliğinden aktar")} checked={settings.autoImportSpells} onChange={(v) => updateSettings({ autoImportSpells: v })} />
              <Toggle label={t("Eşya setini kendiliğinden aktar")} checked={settings.autoImportItems} onChange={(v) => updateSettings({ autoImportItems: v })} />
              <Toggle label={t("Şampiyon seçiminde Vizier'i öne getir")} checked={settings.showOnChampSelect} onChange={(v) => updateSettings({ showOnChampSelect: v })} />
            </div>
          </>
        )}
        {step === "game" && (
          <>
            <p className="welcome__lead">
              {t("Oyun başlayınca ekranın üstünde küçük kartlar belirir: ejder ve Baron süreleri, sıradaki eşya, ölü rakiplerin dönüş süreleri, rakibin güç eşikleri.")}
            </p>
            <div className="welcome__toggles">
              <Toggle label={t("Oyun içi overlay")} checked={settings.overlay} onChange={(v) => updateSettings({ overlay: v })} />
            </div>
            <p className="build__note">
              {t("Kartları oyunda {keys} ile istediğin yere taşırsın.", { keys: effectiveHotkeys(settings.hotkeys).edit })}{" "}
              <button
                type="button"
                className="link"
                onClick={() => {
                  done();
                  onOpenOverlay();
                }}
              >
                {t("Kartları tek tek seç")}
              </button>
            </p>
          </>
        )}
        {step === "keys" && (
          <>
            <p className="welcome__lead">{t("Klavyeden ayrılmadan her yere ulaşırsın.")}</p>
            <dl className="welcome__keys">
              <div>
                <dt>
                  <kbd>Ctrl</kbd>
                  <kbd>K</kbd>
                </dt>
                <dd>{t("Şampiyon, eşya, eşleşme ya da sayfa ara")}</dd>
              </div>
              <div>
                <dt>
                  <kbd>Ctrl</kbd>
                  <kbd>1–9</kbd>
                </dt>
                <dd>{t("Menüdeki sayfalara atla")}</dd>
              </div>
              <div>
                <dt>
                  <kbd>?</kbd>
                </dt>
                <dd>{t("Bütün kısayolları gör")}</dd>
              </div>
            </dl>
          </>
        )}
      </div>

      <footer className="welcome__actions">
        {index > 0 ? (
          <Button variant="ghost" onClick={() => setIndex(index - 1)}>
            {t("Geri")}
          </Button>
        ) : (
          <Button variant="ghost" onClick={done}>
            {t("Atla")}
          </Button>
        )}
        <Button variant="primary" onClick={last ? done : () => setIndex(index + 1)}>
          {last ? t("Başla") : t("Devam")}
        </Button>
      </footer>
    </Modal>
  );
}
