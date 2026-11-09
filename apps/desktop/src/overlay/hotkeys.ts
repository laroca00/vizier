// Overlay hotkeys. The defaults match what the Rust side registers; a player's
// own choice is kept in settings and sent over as `{ action: "Ctrl+Shift+K" }`.

export type HotkeyAction = { id: string; label: string; combo: string };

export const HOTKEY_ACTIONS: readonly HotkeyAction[] = [
  { id: "toggle", label: "Paneli gizle ya da göster", combo: "Ctrl+Shift+O" },
  { id: "edit", label: "Kutuları yerleştir", combo: "Ctrl+Shift+L" },
  { id: "blue", label: "Mavi", combo: "Ctrl+Shift+1" },
  { id: "red", label: "Kırmızı", combo: "Ctrl+Shift+2" },
  { id: "gromp", label: "Gromp", combo: "Ctrl+Shift+3" },
  { id: "wolves", label: "Kurtlar", combo: "Ctrl+Shift+4" },
  { id: "raptors", label: "Kuşlar", combo: "Ctrl+Shift+5" },
  { id: "krugs", label: "Golemler", combo: "Ctrl+Shift+6" },
  { id: "scuttle", label: "Yengeç", combo: "Ctrl+Shift+7" },
  { id: "dragon", label: "Ejder", combo: "Ctrl+Shift+D" },
  { id: "baron", label: "Baron", combo: "Ctrl+Shift+B" },
  { id: "stopwatch", label: "Kronometreyi başlat ya da durdur", combo: "Ctrl+Shift+S" },
  { id: "custom", label: "Özel zamanlayıcı", combo: "Ctrl+Shift+T" },
  { id: "clear", label: "Hepsini temizle", combo: "Ctrl+Shift+X" },
  { id: "skills", label: "Yetenek sırasını göster ya da gizle", combo: "Ctrl+Shift+K" },
  { id: "augments", label: "Augment kartını göster ya da gizle", combo: "Ctrl+Shift+A" },
  { id: "build", label: "Build panelini göster ya da gizle", combo: "Ctrl+Shift+I" },
];

type KeyEvent = Pick<KeyboardEvent, "code" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey">;

function keyName(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return code === "Space" ? "Space" : null;
}

/** The combination a key press makes, or null when it is only a modifier or has no modifier. */
export function comboFromEvent(event: KeyEvent): string | null {
  const key = keyName(event.code);
  if (!key) return null;
  const mods = [event.ctrlKey && "Ctrl", event.altKey && "Alt", event.shiftKey && "Shift", event.metaKey && "Super"].filter(Boolean);
  // A bare key would fire while typing in other apps.
  return mods.length === 0 ? null : [...mods, key].join("+");
}

/** Every action's combination with the player's choices laid over the defaults. */
export function effectiveHotkeys(overrides: Record<string, string>): Record<string, string> {
  return Object.fromEntries(HOTKEY_ACTIONS.map((a) => [a.id, overrides[a.id] ?? a.combo]));
}

/** Actions that share a combination with another action. */
export function clashing(overrides: Record<string, string>): Set<string> {
  const byCombo = new Map<string, string[]>();
  for (const [id, combo] of Object.entries(effectiveHotkeys(overrides))) byCombo.set(combo.toLowerCase(), [...(byCombo.get(combo.toLowerCase()) ?? []), id]);
  return new Set([...byCombo.values()].filter((ids) => ids.length > 1).flat());
}

/** Choices that differ from the default, which is all the Rust side needs. */
export function changedHotkeys(overrides: Record<string, string>): Record<string, string> {
  return Object.fromEntries(HOTKEY_ACTIONS.flatMap((a) => (overrides[a.id] && overrides[a.id] !== a.combo ? [[a.id, overrides[a.id]]] : [])));
}
