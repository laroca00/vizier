import type { PaletteLink } from "./paletteSearch";
import type { Settings } from "./settings";

// Actions the search palette offers next to pages. Ids start with "cmd:" so
// the palette's link handler can tell them from pages.

export const COMMAND_PREFIX = "cmd:";

type CommandSettings = Pick<Settings, "overlay" | "autoImportRunes" | "autoImportSpells" | "autoImportItems" | "autoAcceptReady">;

const autoImportOn = (s: CommandSettings) => s.autoImportRunes && s.autoImportSpells && s.autoImportItems;

/** The commands with labels that say what pressing them does now. */
export function commandLinks(s: CommandSettings): PaletteLink[] {
  return [
    { id: `${COMMAND_PREFIX}overlay`, label: s.overlay ? "Overlay'i kapat" : "Overlay'i aç", icon: "overlay" },
    { id: `${COMMAND_PREFIX}autoImport`, label: autoImportOn(s) ? "Otomatik aktarımı kapat" : "Otomatik aktarımı aç", icon: "library" },
    { id: `${COMMAND_PREFIX}autoAccept`, label: s.autoAcceptReady ? "Maçı kendiliğinden kabul etmeyi kapat" : "Maçı kendiliğinden kabul et", icon: "queue" },
    { id: `${COMMAND_PREFIX}keys`, label: "Klavye kısayollarını göster", icon: "search" },
    { id: `${COMMAND_PREFIX}welcome`, label: "Tanıtımı yeniden göster", icon: "about" },
  ];
}

/** The settings change a command makes, or null for commands that only open something. */
export function commandPatch(id: string, s: CommandSettings): Partial<Settings> | null {
  switch (id.slice(COMMAND_PREFIX.length)) {
    case "overlay":
      return { overlay: !s.overlay };
    case "autoImport": {
      const on = !autoImportOn(s);
      return { autoImportRunes: on, autoImportSpells: on, autoImportItems: on };
    }
    case "autoAccept":
      return { autoAcceptReady: !s.autoAcceptReady };
    case "welcome":
      return { welcomeSeen: false };
    default:
      return null;
  }
}
