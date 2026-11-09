// The keyboard help that opens on "?": what the main window answers to.

/** True while the player is typing, when a bare "?" belongs to the text, not to us. */
export function isTyping(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const el = target as { tagName?: string; isContentEditable?: boolean; type?: string };
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA" || el.tagName === "SELECT") return true;
  if (el.tagName !== "INPUT") return false;
  // Checkboxes and buttons take no text.
  return !["checkbox", "radio", "button", "submit", "range", "color"].includes(el.type ?? "text");
}

export type ShortcutRow = { keys: string[]; label: string };

/** App shortcuts in reading order; `pages` are the menu entries Ctrl+1 to Ctrl+9 open. */
export function appShortcuts(pages: string[]): ShortcutRow[] {
  return [
    { keys: ["Ctrl", "K"], label: "Ara: şampiyon, eşya, sayfa, eşleşme" },
    ...pages.map((label, i) => ({ keys: ["Ctrl", String(i + 1)], label })),
    { keys: ["Alt", "←"], label: "Geri" },
    { keys: ["Alt", "→"], label: "İleri" },
    { keys: ["?"], label: "Bu listeyi aç" },
  ];
}
