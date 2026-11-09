import { useT } from "./i18n";
import { effectiveHotkeys, HOTKEY_ACTIONS } from "./overlay/hotkeys";
import { useSettings } from "./settings";
import { appShortcuts, type ShortcutRow } from "./shortcuts";
import { Modal } from "./ui/Modal";
import "./ShortcutsHelp.css";

const CAMPS = new Set(["blue", "red", "gromp", "wolves", "raptors", "krugs", "scuttle"]);

function Rows({ rows }: { rows: ShortcutRow[] }) {
  const t = useT();
  return (
    <dl className="keys">
      {rows.map((row) => (
        <div key={row.keys.join("+") + row.label} className="keys__row">
          <dt>{t(row.label)}</dt>
          <dd>
            {row.keys.map((key) => (
              <kbd key={key}>{key}</kbd>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Every key the app and the overlay answer to, with the player's own overlay bindings. */
export function ShortcutsHelp({ open, onClose, pages }: { open: boolean; onClose: () => void; pages: string[] }) {
  const t = useT();
  const { hotkeys } = useSettings();
  const bound = effectiveHotkeys(hotkeys);
  const overlay = HOTKEY_ACTIONS.map((a) => ({
    keys: bound[a.id].split("+"),
    label: CAMPS.has(a.id) || a.id === "dragon" || a.id === "baron" ? t("{name} zamanlayıcısı", { name: t(a.label) }) : a.label,
  }));
  return (
    <Modal open={open} title={t("Klavye kısayolları")} onClose={onClose} wide>
      <div className="keys__columns">
        <section className="keys__section">
          <h3 className="keys__title">{t("Uygulama")}</h3>
          <Rows rows={appShortcuts(pages)} />
        </section>
        <section className="keys__section">
          <h3 className="keys__title">{t("Oyun içi")}</h3>
          <p className="build__note">{t("Overlay sayfasından değiştirebilirsin.")}</p>
          <Rows rows={overlay} />
        </section>
      </div>
    </Modal>
  );
}
