// Everything Vizier keeps on this computer lives in localStorage under the
// "vizier." prefix: settings, the champion pool and notes, chosen build
// styles and the overlay layout. These move it in and out as one file.

const PREFIX = "vizier.";
const FORMAT = "vizier-local-data";

type Exported = { format: typeof FORMAT; version: 1; exportedAt: string; entries: Record<string, string> };

function keys(): string[] {
  const found: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) found.push(key);
  }
  return found;
}

export function exportLocalData(): Blob {
  const entries: Record<string, string> = {};
  for (const key of keys()) entries[key] = localStorage.getItem(key) ?? "";
  const data: Exported = { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), entries };
  return new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
}

/** Replaces the local data with the file's; throws when the file isn't a Vizier export. */
export async function importLocalData(file: File) {
  let data: Exported;
  try {
    data = JSON.parse(await file.text()) as Exported;
  } catch {
    throw new Error("not-json");
  }
  if (data?.format !== FORMAT || typeof data.entries !== "object" || data.entries === null) throw new Error("not-vizier");
  const entries = Object.entries(data.entries).filter(([key, value]) => key.startsWith(PREFIX) && typeof value === "string");
  clearLocalData();
  for (const [key, value] of entries) localStorage.setItem(key, value);
}

export function clearLocalData() {
  for (const key of keys()) localStorage.removeItem(key);
}

/** The stores read localStorage once at start, so a reload is the simplest way to pick up new data. */
export const reloadApp = () => location.reload();
