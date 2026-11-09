/** Existing installs saved the old off defaults; flip the three switches on once. */
export function withAutoImportOn<T extends object>(stored: T) {
  return { ...stored, autoImportRunes: true, autoImportSpells: true, autoImportItems: true };
}
