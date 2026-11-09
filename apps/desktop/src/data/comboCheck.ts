import type { Combo } from "./combos";
import type { HistoryStep } from "../patches/history";

const patchNumber = (version: string) => {
  const [major, minor] = version.split(".").map(Number);
  return major * 1000 + minor;
};

/** Ability letters whose cooldown, cost or range changed in a patch newer than the one the combos were written for. */
export function changedAbilities(steps: HistoryStep[], writtenFor: string): Map<string, string> {
  const changed = new Map<string, string>();
  for (const { to, entry } of [...steps].reverse()) {
    if (patchNumber(to) <= patchNumber(writtenFor)) continue;
    for (const change of entry.changes) {
      const match = /^spell:([QWER]):/.exec(change.field);
      if (match && !changed.has(match[1])) changed.set(match[1], to);
    }
  }
  return changed;
}

/** The patch that touched an ability the combo uses, or null. */
export function comboChangedIn(combo: Combo, changed: Map<string, string>): string | null {
  for (const token of combo.sequence) {
    const patch = changed.get(token[0]);
    if (patch) return patch;
  }
  return null;
}
